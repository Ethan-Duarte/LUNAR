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
  "apollo-12": {text:"Apollo 12 demonstrated a precise arrival near Surveyor 3. Retrieving spacecraft material let researchers examine exposure to the lunar environment.",question:"How would uncertainty in landing position affect access to a nearby target?",source:"https://www.nasa.gov/missions/apollo/apollo-12-the-pinpoint-mission/"},
  "apollo-14": {text:"Apollo 14 explored the Fra Mauro uplands. Its surface work connects site selection with the practical distance astronauts must travel to reach useful samples.",question:"Does a promising science destination also provide useful illumination and a practical connection to a habitat?",source:"https://www.nasa.gov/missions/apollo/apollo-14-mission-details/"},
  "apollo-16": {text:"Apollo 16 investigated the Descartes highlands with a lunar rover. Highland terrain offers a different setting from the smoother volcanic plains visited by earlier crews.",question:"Compare this terrain with Apollo 11. Which differences are visible in our elevation grid, and which would need finer data?",source:"https://www.nasa.gov/specials/apollo50th/missions.html"},
  "apollo-17": {text:"Apollo 17 explored Taurus–Littrow in December 1972. A valley beside substantial relief provides a useful setting for examining the relationship between local terrain and the sky.",question:"Could a nearby ridge affect an observer’s visibility even when the body is above the mathematical horizon?",source:"https://science.nasa.gov/solar-system/moon/history-of-lunar-exploration/"},
};
