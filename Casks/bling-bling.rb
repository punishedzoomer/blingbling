cask "bling-bling" do
  version "0.1.3"
  sha256 "6ad180c72f8bdcb63e801f3ba1bea308cec729f0062e3540c38c2fa2086acf9c"

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
