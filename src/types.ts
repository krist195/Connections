export type Lang = "ru" | "en";

export type Ternary = "yes" | "no" | "unknown";

export type Subculture =
  | "unknown"
  | "normal"
  | "oldmoney"
  | "punk"
  | "alt"
  | "goth"
  | "emo"
  | "metal"
  | "hiphop"
  | "raver"
  | "grunge"
  | "skater"
  | "anime"
  | "kpop"
  | "cyber"
  | "streetwear"
  | "sport"
  | "business"
  | "boho"
  | "artsy"
  | "military"
  | "skinhead";

export type Orientation = "unknown" | "girls" | "boys" | "both";
export type Finance = "unknown" | "low" | "middle" | "high";

export type RelationshipStatus =
  | "unknown"
  | "single"
  | "dating"
  | "relationship"
  | "married"
  | "complicated";

export type BodyType = "unknown" | "slim" | "average" | "athletic" | "heavy";
export type EyeColor = "unknown" | "brown" | "blue" | "green" | "gray" | "hazel" | "other";
export type HairLength = "unknown" | "short" | "medium" | "long" | "very_long" | "bald";
export type HairStyle =
  | "unknown"
  | "straight"
  | "wavy"
  | "curly"
  | "dreads"
  | "braids"
  | "buzzcut"
  | "undercut"
  | "other";
export type HairColor =
  | "unknown"
  | "blonde"
  | "brown"
  | "black"
  | "red"
  | "white"
  | "colored"
  | "other";

// ✅ добавили in_relationship
export type ConnectionKind = "acquaintance" | "friend" | "best_friend" | "family" | "in_relationship";
export type FamilyRole = "brother" | "sister" | "mother" | "father";

export interface Vec2 {
  x: number;
  y: number;
}

export interface SocialLink {
  id: string;
  type: string;
  value: string;
}

export interface Person {
  id: string;
  position: Vec2;

  // photos
  photos: string[]; // base64 dataURL

  // identity
  name: string | null;
  surname: string | null;
  nickname: string | null; // NEW
  birthday: string | null;
  city: string | null;

  // habits / profile
  smokes: Ternary;
  uses: Ternary;
  subculture: Subculture;
  orientation: Orientation;
  finance: Finance;
  relationshipStatus: RelationshipStatus;

  // appearance
  heightCm: number | null;
  weightKg: number | null;
  bodyType: BodyType;
  eyeColor: EyeColor;
  hairLength: HairLength;
  hairStyle: HairStyle;
  hairColor: HairColor;
  tattoos: Ternary;
  piercing: Ternary;

  // contacts
  phone: string | null;
  email: string | null;
  occupation: string | null;
  tags: string[];
  socials: SocialLink[];

  // notes
  notes: string;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  kind: ConnectionKind;
  familyRole?: FamilyRole;
  color: string;
}

export interface ConnectionsMeta {
  app: "Connections";
  version: number;
  createdAt: string;
  updatedAt: string;
  language: Lang;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface ConnectionsFile {
  meta: ConnectionsMeta;
  people: Record<string, Person>;
  connections: Connection[];
  viewport: Viewport;
}

export type PendingConnection = { from: string; to: string } | null;
