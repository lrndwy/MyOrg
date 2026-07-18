package services

import (
	"fmt"
	"time"

	"myorg/apps/api/internal/models"
)

// FinancePeriodStats holds income/expense/net for a time window.
type FinancePeriodStats struct {
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
	Net     float64 `json:"net"`
}

// FinanceCashflowPoint is one day in the cashflow series.
type FinanceCashflowPoint struct {
	Date    string  `json:"date"`
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
	Net     float64 `json:"net"`
	Balance float64 `json:"balance"`
}

// FinanceCategoryTotal is spending/income grouped by category.
type FinanceCategoryTotal struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Type         string  `json:"type"`
	Total        float64 `json:"total"`
}

// FinanceDashboard aggregates stats, charts, and recent activity.
type FinanceDashboard struct {
	AllTime         FinanceSummary         `json:"all_time"`
	ThisWeek        FinancePeriodStats     `json:"this_week"`
	ThisMonth       FinancePeriodStats     `json:"this_month"`
	Cashflow        []FinanceCashflowPoint `json:"cashflow"`
	IncomeByCategory  []FinanceCategoryTotal `json:"income_by_category"`
	ExpenseByCategory []FinanceCategoryTotal `json:"expense_by_category"`
	RecentUpdates   []models.FinanceTransaction `json:"recent_updates"`
}

// Dashboard returns finance analytics for the admin dashboard.
func (s *FinanceTransactionService) Dashboard(days int) (*FinanceDashboard, error) {
	if days <= 0 {
		days = 30
	}
	if days > 365 {
		days = 365
	}

	allTime, err := s.Summary()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	loc := now.Location()

	thisWeek, err := s.periodStats(weekStart(now, loc), endOfDay(now, loc))
	if err != nil {
		return nil, err
	}
	thisMonth, err := s.periodStats(monthStart(now, loc), endOfDay(now, loc))
	if err != nil {
		return nil, err
	}

	periodStart := startOfDay(now.AddDate(0, 0, -(days-1)), loc)
	periodEnd := endOfDay(now, loc)

	cashflow, err := s.buildCashflow(periodStart, periodEnd)
	if err != nil {
		return nil, err
	}

	incomeCats, expenseCats, err := s.categoryBreakdown(periodStart, periodEnd)
	if err != nil {
		return nil, err
	}

	var recent []models.FinanceTransaction
	if err := s.DB.Preload("Category").Preload("RecordedBy").
		Order("updated_at DESC").
		Limit(8).
		Find(&recent).Error; err != nil {
		return nil, fmt.Errorf("recent finance updates: %w", err)
	}

	return &FinanceDashboard{
		AllTime:           *allTime,
		ThisWeek:          thisWeek,
		ThisMonth:         thisMonth,
		Cashflow:          cashflow,
		IncomeByCategory:  incomeCats,
		ExpenseByCategory: expenseCats,
		RecentUpdates:     recent,
	}, nil
}

func (s *FinanceTransactionService) periodStats(from, to time.Time) (FinancePeriodStats, error) {
	income, expense, err := s.sumTypesBetween(from, to)
	if err != nil {
		return FinancePeriodStats{}, err
	}
	return FinancePeriodStats{
		Income:  income,
		Expense: expense,
		Net:     income - expense,
	}, nil
}

func (s *FinanceTransactionService) sumTypesBetween(from, to time.Time) (income, expense float64, err error) {
	type row struct {
		Type  string
		Total float64
	}
	var rows []row
	q := s.DB.Model(&models.FinanceTransaction{}).
		Select("type, COALESCE(SUM(amount), 0) as total").
		Where("transaction_date >= ? AND transaction_date <= ?", from, to).
		Group("type")
	if err := q.Scan(&rows).Error; err != nil {
		return 0, 0, fmt.Errorf("sum finance by type: %w", err)
	}
	for _, r := range rows {
		switch r.Type {
		case "income":
			income = r.Total
		case "expense":
			expense = r.Total
		}
	}
	return income, expense, nil
}

func (s *FinanceTransactionService) buildCashflow(from, to time.Time) ([]FinanceCashflowPoint, error) {
	openIncome, openExpense, err := s.sumTypesBefore(from)
	if err != nil {
		return nil, err
	}
	running := openIncome - openExpense

	type dailyRow struct {
		Day   time.Time
		Type  string
		Total float64
	}
	var rows []dailyRow
	if err := s.DB.Model(&models.FinanceTransaction{}).
		Select("DATE(transaction_date) as day, type, COALESCE(SUM(amount), 0) as total").
		Where("transaction_date >= ? AND transaction_date <= ?", from, to).
		Group("DATE(transaction_date), type").
		Order("day asc").
		Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("daily cashflow: %w", err)
	}

	byDay := map[string]FinanceCashflowPoint{}
	for _, r := range rows {
		key := r.Day.Format("2006-01-02")
		pt := byDay[key]
		pt.Date = key
		switch r.Type {
		case "income":
			pt.Income = r.Total
		case "expense":
			pt.Expense = r.Total
		}
		byDay[key] = pt
	}

	out := make([]FinanceCashflowPoint, 0)
	for d := startOfDay(from, from.Location()); !d.After(to); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		pt := byDay[key]
		pt.Date = key
		pt.Net = pt.Income - pt.Expense
		running += pt.Net
		pt.Balance = running
		out = append(out, pt)
	}
	return out, nil
}

func (s *FinanceTransactionService) sumTypesBefore(before time.Time) (income, expense float64, err error) {
	type row struct {
		Type  string
		Total float64
	}
	var rows []row
	if err := s.DB.Model(&models.FinanceTransaction{}).
		Select("type, COALESCE(SUM(amount), 0) as total").
		Where("transaction_date < ?", before).
		Group("type").
		Scan(&rows).Error; err != nil {
		return 0, 0, fmt.Errorf("opening balance: %w", err)
	}
	for _, r := range rows {
		switch r.Type {
		case "income":
			income = r.Total
		case "expense":
			expense = r.Total
		}
	}
	return income, expense, nil
}

func (s *FinanceTransactionService) categoryBreakdown(from, to time.Time) (income, expense []FinanceCategoryTotal, err error) {
	type row struct {
		CategoryID   string
		CategoryName string
		Type         string
		Total        float64
	}
	var rows []row
	if err := s.DB.Model(&models.FinanceTransaction{}).
		Select(`finance_transactions.category_id as category_id,
			finance_categories.name as category_name,
			finance_transactions.type as type,
			COALESCE(SUM(finance_transactions.amount), 0) as total`).
		Joins("JOIN finance_categories ON finance_categories.id = finance_transactions.category_id").
		Where("finance_transactions.transaction_date >= ? AND finance_transactions.transaction_date <= ?", from, to).
		Group("finance_transactions.category_id, finance_categories.name, finance_transactions.type").
		Order("total DESC").
		Scan(&rows).Error; err != nil {
		return nil, nil, fmt.Errorf("category breakdown: %w", err)
	}

	for _, r := range rows {
		item := FinanceCategoryTotal{
			CategoryID:   r.CategoryID,
			CategoryName: r.CategoryName,
			Type:         r.Type,
			Total:        r.Total,
		}
		switch r.Type {
		case "income":
			income = append(income, item)
		case "expense":
			expense = append(expense, item)
		}
	}
	if income == nil {
		income = []FinanceCategoryTotal{}
	}
	if expense == nil {
		expense = []FinanceCategoryTotal{}
	}
	return income, expense, nil
}

func weekStart(t time.Time, loc *time.Location) time.Time {
	t = t.In(loc)
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return startOfDay(t.AddDate(0, 0, -(weekday - 1)), loc)
}

func monthStart(t time.Time, loc *time.Location) time.Time {
	t = t.In(loc)
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, loc)
}

func startOfDay(t time.Time, loc *time.Location) time.Time {
	t = t.In(loc)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
}

func endOfDay(t time.Time, loc *time.Location) time.Time {
	t = t.In(loc)
	return time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999999999, loc)
}
