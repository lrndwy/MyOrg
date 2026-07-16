export interface OrganizationSetting {
  id: string;
  web_name: string;
  logo_url: string;
  icon_url: string;
  theme: string;
  allow_self_register: boolean;
  allow_cross_division_events_view: boolean;
  letterhead_template_url: string;
  letter_place: string;
  signature_id_label: string;
  version: number;
  created_at: string;
  updated_at: string;
}
