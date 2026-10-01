import "dotenv/config";
import { runPipeline } from "./pipeline.js";

runPipeline("I have a sore throat for the past day, no fever").then((result) => {
  console.log(JSON.stringify(result, null, 2));
});