/* eslint-disable no-empty */
/* eslint-disable prefer-destructuring */

const path = require("path");
const { exec, execSync } = require("child_process");
const { readFile, unlink } = require("fs").promises;
const Jimp = require("jimp");
const screenshotDesktop = require("screenshot-desktop");

// Emr configs
let emrConfigs = null;
// Jimp object representing last screenshot taken
let lastScreenshot = null;
// User data path
let userDataPath = "";

// Osascript to detect title of active window in case the active win fails
const osascript = `
global frontApp, frontAppName, windowTitle

set windowTitle to ""
tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set frontAppName to name of frontApp
    tell process frontAppName
        tell (1st window whose value of attribute "AXMain" is true)
            set windowTitle to value of attribute "AXTitle"
        end tell
    end tell
end tell

return {windowTitle}
`;

// Get ermConfigs from command line
try {
  emrConfigs = JSON.parse(process.argv[2]).config;
} catch {
  emrConfigs = [];
}
// Get user data path from command line
userDataPath = process.argv[3];

/**
 * Writes object to stdout
 * @param {Object} data
 */
const print = (data) => {
  // Using console.log since it appends '\n' character at the end automatically
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(data));
};

/**
 * Takes screenshot of window with provided windowId on MacOS
 * @param {number} windowId Window ID
 * @returns {Object} Screenshot in the form of Jimp image object
 */
const grabScreenshotMac = (windowId) =>
  new Promise((resolve, reject) => {
    let screenshot = null;
    const tempPath = path.join(userDataPath, `${new Date().valueOf()}.jpg`);
    exec(`screencapture -l ${windowId} -o -x -t jpg '${tempPath}'`, (error) => {
      if (error) {
        reject(error);
      }

      // Read saved screenshot into buffer
      readFile(tempPath)
        .then((img) => {
          screenshot = img;
          // Delete saved screenshot
          return unlink(tempPath);
        })
        // Create Jimp object
        .then(() => Jimp.read(screenshot))
        // Scale down screenshot
        .then((img) => img.scale(0.5))
        .then((img) => resolve(img))
        .catch((err) => reject(err));
    });
  });

/**
 * Take screenshot of the windows with given window bounds on windows os
 * @param {Object} bounds Window bounds
 * @return {Object} Screenshot in the form of Jimp image object
 */
const grabScreenshotWindows = ({ left, top, right, bottom }) => {
  const x = left;
  const y = top;
  const width = right - top;
  const height = bottom - top;
  return screenshotDesktop()
    .then((img) => {
      return Jimp.read(img);
    })
    .then((img) => {
      return img.crop(x, y, width, height);
    });
};

/**
 * Take screenshot
 * @param {number} windowId
 * @param {Object} windowBounds
 * @return {Object} Screenshot in the form of Jimp image object
 */
const grabScreenshot = (windowId, windowBounds) => {
  try {
    if (process.platform === "win32")
      return grabScreenshotWindows(windowBounds);
    return grabScreenshotMac(windowId);
  } catch (err) {
    return Promise.reject(err);
  }
};

/**
 * Converts a rect buffer to a rect object
 * @param {Object} buffer Rect buffer
 * @returns {Object} Rect object
 */
const rectBufferToObject = (buffer) => {
  const rect = {};
  rect.left = buffer.readInt32LE(0) < 0 ? 0 : buffer.readInt32LE(0);
  rect.top = buffer.readInt32LE(4) < 0 ? 0 : buffer.readInt32LE(4);
  rect.right = buffer.readInt32LE(8);
  rect.bottom = buffer.readInt32LE(12);
  return rect;
};

/**
 * Get active window on win32 platform
 * @returns {Object} Active window details
 */
const getActiveWindowWin32 = () => {
  const { U } = require("win32-api");
  const u32 = U.load([
    "GetForegroundWindow",
    "GetWindowTextW",
    "GetWindowRect",
  ]);

  const titleBuffer = Buffer.alloc(1000);
  const rectBuffer = Buffer.alloc(16);

  const windowHandle = u32.GetForegroundWindow();
  u32.GetWindowTextW(windowHandle, titleBuffer, 1000);
  u32.GetWindowRect(windowHandle, rectBuffer);

  const title = titleBuffer.toString("ucs-2").replace(/\0/g, "");
  const bounds = rectBufferToObject(rectBuffer);

  return { title, bounds };
};

/**
 * Crops screenshot according to crop percentages
 * @param {Object} img Jimp image object
 * @param {Object} cropPercentages Crop percentages
 * @return {Object} Jimp image object
 */
const cropScreenshot = (img, cropPercentages) => {
  // Finding bounding box
  const { width, height } = img.bitmap;
  const { left, top, right, bottom } = cropPercentages;
  const x = Math.floor((left * width) / 100);
  const y = Math.floor((top * height) / 100);
  const w = Math.ceil((right * width) / 100 - x);
  const h = Math.ceil((bottom * height) / 100 - y);

  return img.crop(x, y, w, h);
};

/**
 * Detects active EMR window
 * @return {Object|null} Object containing active EMR window information.
 * Returns null if EMR not found or in case of error
 */
const detectWindow = () => {
  try {
    let window = {};
    // Get active window title and id
    if (process.platform === "win32") {
      window = getActiveWindowWin32();
    } else if (process.platform === "darwin") {
      const activeWin = require("active-win");
      window = activeWin.sync();
    }
    let { title } = window;
    const { bounds, id } = window;

    // In case active win fails to detect title
    if (title === "" && process.platform === "darwin") {
      try {
        const output = execSync(`osascript -e '${osascript}'`);
        title = output.toString();
      } catch {}
    }

    // Check if title matches any emr
    const index = emrConfigs.findIndex((config) =>
      title.includes(config.windowWildCard)
    );

    // If title matches then return window info
    if (index > -1) {
      const config = emrConfigs[index];
      return {
        windowId: id,
        windowTitle: title,
        windowBounds: bounds,
        emrKey: config.emrKey,
        cropPercentages: config.cropPercentages,
      };
    }
    // Return null otherwise
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Finds whether the current screenshot is different from the last screenshot
 * @param {Object} screenshot Jimp image object
 * @return {boolean} Whether the screenshot is different
 */
const isScreenshotDifferent = (screenshot) => {
  if (!screenshot || !lastScreenshot) return true;
  return Boolean(Jimp.diff(screenshot, lastScreenshot, 0).percent);
};

// Writing canAcceptConfig to stdout signaling child process is ready to accept new config
print({ canAcceptConfig: true });

// Listening for new emr configs
process.stdin.on("data", (data) => {
  try {
    const newEmrConfigs = JSON.parse(data).config;
    emrConfigs = newEmrConfigs;
  } catch {}
});

// Repeat the process every two seconds
setInterval(() => {
  // Get window info
  const window = detectWindow();
  if (window) {
    // If window info is not null
    grabScreenshot(window.windowId, window.windowBounds)
      .then((screenshot) => {
        // Throw error in case of no screenshot
        if (!screenshot) {
          return Promise.reject(new Error("Screenshot can't be taken"));
        }

        // Crop the screenshot
        const croppedScreenshot = cropScreenshot(
          screenshot.clone(), // Sending clone of origional screenshot as we need origional screenshot
          window.cropPercentages
        );

        // Compare cropped screenshot with last croppped screenshot
        if (isScreenshotDifferent(croppedScreenshot)) {
          // Save cropped screenshot as lastScreenshot for comparision in next iteration
          lastScreenshot = croppedScreenshot;
          // Return origional screenshot in the form of base64 string
          return screenshot.getBase64Async("image/png");
        }

        // Screenshot were same
        return Promise.reject(
          new Error("Screenshot same as previous screenshot")
        );
      })
      .then((base64Screenshot) => {
        const data = {
          emrKey: window.emrKey,
          windowTitle: window.windowTitle,
          // Remove mime type from the string as it is handled in UI
          screenshot: base64Screenshot.replace("data:image/png;base64,", ""),
        };
        print(data);
      })
      .catch((error) => {
        process.stderr.write(JSON.stringify(error));
      });
  }
}, 2000);
