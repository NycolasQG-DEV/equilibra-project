import { SkillSchema } from "./packages/core/src/skill-schema";
import fs from "fs";

const culinary = JSON.parse(fs.readFileSync("./skills/culinary.skill.json", "utf-8"));
const mech = JSON.parse(fs.readFileSync("./skills/industrial-mechanics.skill.json", "utf-8"));

console.log("Validando Culinary...");
const res1 = SkillSchema.safeParse(culinary);
if (!res1.success) {
    console.log("Erro em Culinary:", JSON.stringify(res1.error.flatten(), null, 2));
} else {
    console.log("Culinary OK!");
}

console.log("Validando Mechanics...");
const res2 = SkillSchema.safeParse(mech);
if (!res2.success) {
    console.log("Erro em Mechanics:", JSON.stringify(res2.error.flatten(), null, 2));
} else {
    console.log("Mechanics OK!");
}
