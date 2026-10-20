import {
  credentialsFromAuthContext,
  type ViroVPSCredentials,
} from "../../AR/ViroVPSClient";
import { VRTStudioModule } from "../VRTStudioModule";

/**
 * Read per request, since a session token is replaced when it refreshes. The
 * project is the scene's, not the manifest's.
 */
export async function studioVpsCredentials(
  projectId: string
): Promise<ViroVPSCredentials> {
  return credentialsFromAuthContext(
    await VRTStudioModule.rvGetAuthHeaders(),
    projectId
  );
}
