// Mot de passe temporaire lisible, à transmettre de vive voix ou par message
// à la personne dont l'administrateur vient de créer (ou réinitialiser) le
// compte (écran /comptes). Un mot + trois chiffres : assez court pour être
// dicté, assez long pour la règle des 8 caractères minimum de Better Auth.
// La personne le remplace ensuite par le sien depuis « Mon compte ».
const WORDS = [
  "colibri",
  "noisette",
  "mandarine",
  "potiron",
  "edredon",
  "boussole",
  "lanterne",
  "pinceau",
  "myrtille",
  "cabane",
  "ricochet",
  "trefle",
];

function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

export function generateTempPassword(): string {
  return `${WORDS[randomInt(WORDS.length)]}-${100 + randomInt(900)}`;
}
