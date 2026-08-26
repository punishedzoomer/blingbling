cask "bling-bling" do
  version "0.1.2"
  sha256 "b5c05900c95e776ee1dd025bf35984072f80a678ba39340e0fdcb2324c6a2a09"

  url "https://github.com/punishedzoomer/blingbling/releases/download/v#{version}/Bling.Bling_#{version}_aarch64.dmg",
      verified: "github.com/punishedzoomer/blingbling/"
  name "Bling Bling"
  desc "Sleek AI-powered desktop assistant built with Tauri and React"
  homepage "https://notosansdiary.com/Portfolio/Bling-Bling"

  depends_on macos: :catalina

  app "Bling Bling.app"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/Bling Bling.app"]
  end

  zap trash: [
    "~/Library/Application Support/BlingBling",
    "~/Library/Preferences/com.punishedzoomer.blingbling.plist",
    "~/Library/Saved Application State/com.punishedzoomer.blingbling.savedState",
  ]
end
