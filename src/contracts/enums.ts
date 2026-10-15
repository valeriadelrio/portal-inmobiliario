export const AGENCY_STATUS = ["pending", "approved", "suspended", "rejected"] as const;
export const MEMBER_ROLE = ["agent", "agency_admin"] as const;
export const MEMBER_STATUS = ["invited", "active", "removed"] as const;
export const PLATFORM_ROLE = ["platform_admin"] as const;
export const OPERATION = ["sale", "rent"] as const;
export const PROPERTY_TYPE = [
  "house",
  "apartment",
  "ph",
  "lot",
  "commercial",
  "office",
  "garage",
] as const;
export const BUILDING_TYPE = PROPERTY_TYPE.filter((t) => t !== "lot") as readonly Exclude<
  (typeof PROPERTY_TYPE)[number],
  "lot"
>[];
export const PROPERTY_STATUS = ["draft", "active", "reserved", "sold_rented", "paused"] as const;
export const CURRENCY = ["USD", "ARS"] as const;
export const LOCALE = ["es", "en"] as const;
export const INQUIRY_STATUS = ["new", "read", "answered", "archived"] as const;
export const MODERATION_STATUS = ["ok", "hidden"] as const;
export const REPORT_REASON = ["fake", "duplicate", "wrong_info", "inappropriate", "sold", "other"] as const;
export const REPORT_STATUS = ["open", "dismissed", "actioned"] as const;
export const LOT_SERVICES = ["water", "electricity", "gas", "sewer", "asphalt"] as const;

export type AgencyStatus = (typeof AGENCY_STATUS)[number];
export type MemberRole = (typeof MEMBER_ROLE)[number];
export type Operation = (typeof OPERATION)[number];
export type PropertyType = (typeof PROPERTY_TYPE)[number];
export type PropertyStatus = (typeof PROPERTY_STATUS)[number];
export type Currency = (typeof CURRENCY)[number];
export type Locale = (typeof LOCALE)[number];
export type InquiryStatus = (typeof INQUIRY_STATUS)[number];
export type ModerationStatus = (typeof MODERATION_STATUS)[number];
export type ReportReason = (typeof REPORT_REASON)[number];
export type ReportStatus = (typeof REPORT_STATUS)[number];
