import type { ViroVPSCredentials } from "../../AR/ViroVPSClient";
import { VRTStudioModule } from "../VRTStudioModule";

/**
 * Read per request, since a session token is replaced when it refreshes.
 * vps-server takes one credential, and the project is the scene's, not the
 * manifest's.
 */
export async function studioVpsCredentials(
  projectId: string
): Promise<ViroVPSCredentials> {
  const { headers } = await VRTStudioModule.rvGetAuthHeaders();
  const header = (name: string) => {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
    return key === undefined ? undefined : headers[key];
  };
  const accessToken = header("authorization")?.replace(/^Bearer\s+/i, "");
  if (accessToken) return { projectId, accessToken };
  const apiKey = header("x-api-key");
  if (apiKey) return { projectId, apiKey };
  throw new Error("No session or API key to reach vps-server with");
}
