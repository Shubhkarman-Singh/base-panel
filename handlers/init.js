const { db } = require("../handlers/db.js");
const config = require("../config.json");
const { v4: uuidv4 } = require("uuid");
const log = new (require("cat-loggr"))();

async function init() {
  const impulse = await db.get("impulse_instance");
  if (!impulse) {
    log.init("This is probably your first time starting Impulse, welcome!");
    log.init("You can find documentation for the panel at impulse.dev");

    const errorMessages = [];

    let imageCheck = await db.get("images");
    let userCheck = await db.get("users");

    if (!imageCheck) {
      errorMessages.push(
        "Before starting Impulse for the first time, you didn't run the seed command!"
      );
      errorMessages.push("Please run: npm run seed");
    }

    if (!userCheck) {
      errorMessages.push(
        "If you didn't do it already, make a user for yourself: npm run createUser"
      );
    }

    if (errorMessages.length > 0) {
      errorMessages.forEach((errorMsg) => log.error(errorMsg));
      process.exit();
    }

    const impulseId = uuidv4();
    const setupTime = Date.now();

    const info = {
      impulseId: impulseId,
      setupTime: setupTime,
      originalVersion: config.version,
    };

    await db.set("impulse_instance", info);
    log.info("Initialized Impulse panel with ID: " + impulseId);
  }
  log.info("Init complete!");
}

module.exports = { init };
