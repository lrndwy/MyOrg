package letterdoc

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

type pdfPageImage struct {
	data     []byte
	fileName string
}

func collectPDFPagesForOCR(data []byte) ([]pdfPageImage, error) {
	tmpPath, cleanup, err := writeTempDocument(data, "document.pdf")
	if err != nil {
		return nil, err
	}
	defer cleanup()

	if pages, err := pdfPagesViaPdftoppm(tmpPath); err == nil && len(pages) > 0 {
		return pages, nil
	}

	if pages, err := pdfPagesViaPdfcpu(data); err == nil && len(pages) > 0 {
		return pages, nil
	}

	return nil, fmt.Errorf("PDF hasil scan tidak bisa dikonversi ke gambar untuk OCR")
}

func pdfPagesViaPdftoppm(pdfPath string) ([]pdfPageImage, error) {
	if _, err := exec.LookPath("pdftoppm"); err != nil {
		return nil, err
	}

	tmpDir, err := os.MkdirTemp("", "pdf-pages-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	prefix := filepath.Join(tmpDir, "page")
	cmd := exec.Command(
		"pdftoppm", "-png",
		"-f", "1",
		"-l", strconv.Itoa(maxPDFPagesForOCR),
		"-r", pdfRenderDPI,
		pdfPath, prefix,
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("pdftoppm: %w (%s)", err, strings.TrimSpace(string(out)))
	}

	matches, err := filepath.Glob(filepath.Join(tmpDir, "page-*.png"))
	if err != nil {
		return nil, err
	}
	sort.Strings(matches)

	var pages []pdfPageImage
	for i, imgPath := range matches {
		imgData, err := os.ReadFile(imgPath)
		if err != nil {
			continue
		}
		pages = append(pages, pdfPageImage{
			data:     imgData,
			fileName: fmt.Sprintf("page-%d.png", i+1),
		})
	}
	if len(pages) == 0 {
		return nil, fmt.Errorf("pdftoppm tidak menghasilkan gambar")
	}
	return pages, nil
}

func pdfPagesViaPdfcpu(data []byte) ([]pdfPageImage, error) {
	rs := bytes.NewReader(data)
	selected := make([]string, maxPDFPagesForOCR)
	for i := range selected {
		selected[i] = strconv.Itoa(i + 1)
	}

	var pages []pdfPageImage
	err := api.ExtractImages(rs, selected, func(img model.Image, _ bool, _ int) error {
		buf, readErr := io.ReadAll(img)
		if readErr != nil {
			return readErr
		}
		if len(buf) == 0 {
			return nil
		}
		ext := imageExtFromPDFCPU(img.FileType)
		pages = append(pages, pdfPageImage{
			data:     buf,
			fileName: fmt.Sprintf("page-%d%s", img.PageNr, ext),
		})
		return nil
	}, nil)
	if err != nil {
		return nil, err
	}
	if len(pages) == 0 {
		return nil, fmt.Errorf("pdfcpu tidak menemukan gambar pada PDF")
	}
	return pages, nil
}

func imageExtFromPDFCPU(fileType string) string {
	switch strings.ToLower(strings.TrimSpace(fileType)) {
	case "jpeg", "jpg":
		return ".jpg"
	case "png":
		return ".png"
	case "tiff", "tif":
		return ".tif"
	case "webp":
		return ".webp"
	default:
		return ".png"
	}
}
