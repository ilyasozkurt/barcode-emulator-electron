const { Key } = require("@nut-tree-fork/nut-js");

const { getEnabledHotkeyModifiers } = require("./shared");

function getNutMetaKeys(platform = process.platform) {
  if (platform === "darwin") {
    return [Key.LeftCmd, Key.RightCmd];
  }

  if (platform === "win32") {
    return [Key.LeftWin, Key.RightWin];
  }

  return [Key.LeftSuper, Key.RightSuper];
}

function createModifierNutKeys(platform = process.platform) {
  const [leftMetaKey, rightMetaKey] = getNutMetaKeys(platform);

  return {
    control: [Key.LeftControl, Key.RightControl],
    alt: [Key.LeftAlt, Key.RightAlt],
    shift: [Key.LeftShift, Key.RightShift],
    super: [leftMetaKey, rightMetaKey],
  };
}

function uniq(values) {
  return [...new Set(values)];
}

function getHotkeyModifierReleaseKeys(spec, platform = process.platform) {
  const modifierNutKeys = createModifierNutKeys(platform);

  return uniq(
    getEnabledHotkeyModifiers(spec)
      .flatMap((modifier) => modifierNutKeys[modifier] ?? []),
  );
}

module.exports = {
  getHotkeyModifierReleaseKeys,
};
