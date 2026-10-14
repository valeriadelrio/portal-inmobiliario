import { PHOTO_WIDTHS } from "@/contracts";

type Width = (typeof PHOTO_WIDTHS)[number];
const base = () => process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "";

export const photoUrl = (storageKey: string, width: Width = 800) => `${base()}/${storageKey}/${width}.webp`;
export const photoSrcSet = (storageKey: string) =>
  PHOTO_WIDTHS.map((w) => `${photoUrl(storageKey, w)} ${w}w`).join(", ");
