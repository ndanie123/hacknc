// Demo stand-in for care-team history imported from a health system portal
// (e.g. Atrium Health, Novant Health). Only doctors the patient has already seen.
import emilyChenPhoto from "@/assets/doctor-emily-chen.webp";
import marcusReedPhoto from "@/assets/doctor-marcus-reed.webp";
import priyaNatarajanPhoto from "@/assets/doctor-priya-natarajan.webp";
import sarahWhitfieldPhoto from "@/assets/doctor-sarah-whitfield.jpeg";

export interface CareTeamMember {
  name: string;
  title: string;
  location: string;
  relationship: "Current PCP" | "Current" | "Previously visited";
  lastVisit: string;
  /** Square, face-centered profile photo served from CDN-backed storage. */
  photo: string;
  /** Log Companion account email, when the doctor is connected. */
  email?: string;
}

export const CARE_TEAM: CareTeamMember[] = [
  {
    name: "Dr. Emily Chen",
    title: "MD, Internal Medicine",
    location: "Atrium Health Primary Care — Charlotte, NC",
    relationship: "Current PCP",
    lastVisit: "Sep 18, 2026",
    photo: emilyChenPhoto,
    email: "dr.chen@aerohealth.app",
  },
  {
    name: "Dr. Marcus Reed",
    title: "DO, Family Medicine",
    location: "Novant Health Family Practice — Huntersville, NC",
    relationship: "Previously visited",
    lastVisit: "Mar 2, 2025",
    photo: marcusReedPhoto,
  },
  {
    name: "Dr. Priya Natarajan",
    title: "MD, Neurology",
    location: "Atrium Health Neurology — Concord, NC",
    relationship: "Current",
    lastVisit: "Jul 9, 2026",
    photo: priyaNatarajanPhoto,
  },
  {
    name: "Sarah Whitfield",
    title: "PA-C, Women's Health",
    location: "Novant Health OB/GYN — Matthews, NC",
    relationship: "Previously visited",
    lastVisit: "Nov 14, 2025",
    photo: sarahWhitfieldPhoto,
  },
];
