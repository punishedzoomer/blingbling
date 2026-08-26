cask "bling-bling" do
  version "0.1.1"
  sha256 "648c5c4cad498d584e9f2dcc0c999bb25958fdea7521dd19a95623d34572826d"

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
