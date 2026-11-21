import { type LoaderHandle } from '../services/install/install.ts';
import { type WebRoute, type WebServerService } from './shared.ts';
export declare function registerTaskRoutes(webServer: WebServerService, profile: string, loader: LoaderHandle | undefined): WebRoute[];
