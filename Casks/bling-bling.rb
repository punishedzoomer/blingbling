cask "bling-bling" do
  version "0.1.0"
  sha256 "8d9d45483afe3adb5ecbc804e3547fa6ee34fa29e3ce795987f11f80fef4efd1"

  url "https://github.com/punishedzoomer/blingbling/releases/download/v#{version}/Bling.Bling_#{version}_aarch64.dmg",
      verified: "github.com/punishedzoomer/blingbling/"
  name "Bling Bling"
  desc "Sleek AI-powered desktop assistant built with Tauri and React"
  homepage "https://notosansdiary.com/Portfolio/Bling-Bling"

  depends_on macos: ">= :catalina"

  app "Bling Bling.app"

  zap trash: [
    "~/Library/Application Support/BlingBling",
    "~/Library/Preferences/com.punishedzoomer.blingbling.plist",
    "~/Library/Saved Application State/com.punishedzoomer.blingbling.savedState",
  ]
end
