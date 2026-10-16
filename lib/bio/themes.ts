/** Bio page themes (Batch 10). Plain colour sets, applied as inline styles. */
export interface BioTheme {
  id: string;
  label: string;
  bg: string;
  text: string;
  muted: string;
  button: string;
  buttonText: string;
  border: string;
}

export const BIO_THEMES: readonly BioTheme[] = [
  { id: "light", label: "Light", bg: "#FAFAFC", text: "#0A0E27", muted: "#6B7280", button: "#FFFFFF", buttonText: "#0A0E27", border: "#E4E1F0" },
  { id: "dark", label: "Dark", bg: "#0A0E27", text: "#FFFFFF", muted: "#A5A9C2", button: "#1B2048", buttonText: "#FFFFFF", border: "#2B3170" },
  { id: "violet", label: "Violet", bg: "#6D35F9", text: "#FFFFFF", muted: "#E4DAFF", button: "#FFFFFF", buttonText: "#3B1BA8", border: "#8F63FB" },
  { id: "sunset", label: "Sunset", bg: "#FF7A59", text: "#2B0F07", muted: "#5C2A1B", button: "#FFF3EE", buttonText: "#2B0F07", border: "#FFB39F" },
  { id: "ocean", label: "Ocean", bg: "#0E7490", text: "#FFFFFF", muted: "#BDE8F2", button: "#ECFEFF", buttonText: "#0B4F63", border: "#38A3BD" },
  { id: "forest", label: "Forest", bg: "#14532D", text: "#FFFFFF", muted: "#BBF7D0", button: "#F0FDF4", buttonText: "#14532D", border: "#2F7A4D" },
];

export const BIO_THEME_IDS: readonly string[] = BIO_THEMES.map((t) => t.id);

export function getBioTheme(id: string | null | undefined): BioTheme {
  return BIO_THEMES.find((t) => t.id === id) ?? BIO_THEMES[0];
}
