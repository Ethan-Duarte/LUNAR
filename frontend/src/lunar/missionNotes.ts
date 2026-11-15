// Original educational copy, based on the linked NASA sources. No upstream mission prose or showcase assets.
export const MISSION_NOTES: Record<
  string,
  { text: string; question: string; source: string }
> = {
  "apollo-11": {
    text: "Eagle carried the first people to the lunar surface in July 1969. This low-latitude landing provides a useful contrast with the south pole: long lunar days and nights replace the nearly horizontal polar path of the Sun.",
    question:
      "Compare this site with Connecting Ridge. Which location has the longer continuous darkness under the same dates and visibility rule?",
    source: "https://www.nasa.gov/mission/apollo-11/",
  },
  "apollo-15": {
    text: "Apollo 15 brought a lunar rover to the Hadley–Apennine region. Its mountain-and-rille landscape is a reminder that nearby relief can matter as much as latitude when choosing a location.",
    question:
      "Move an observer between the mountain front and nearby flatter ground. Inspect the terrain horizon before comparing sunlight.",
    source: "https://www.nasa.gov/specials/apollo50th/missions.html",
  },
  "surveyor-1": {
    text: "Surveyor 1 landed robotically in June 1966, before the Apollo surface missions. Its engineering role connects exploration imagery with practical questions about reaching and operating on the lunar ground.",
    question:
      "What does our elevation grid tell you about this site, and which hazards would require finer imagery or measurements?",
    source: "https://science.nasa.gov/mission/surveyor-1/",
  },
};
