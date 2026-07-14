import { env } from "../config/env.js";

export const getTurnCredentials = async (req, res) => {
  try {
    const response = await fetch(
      `https://${env.METERED_DOMAIN}/api/v1/turn/credential?secretKey=${env.METERED_SECRET_KEY}`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Metered API error:", response.status, text);
      return res
        .status(500)
        .json({ message: "Failed to fetch TURN credentials" });
    }

    const iceServers = await response.json();
    res.status(200).json(iceServers);
  } catch (err) {
    console.error("TURN credential fetch failed:", err.message);
    res.status(500).json({ message: "Failed to fetch TURN credentials" });
  }
};
