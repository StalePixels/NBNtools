import { PersonalServer } from '../PersonalServer';
import { Session } from "../Session";
export declare class CDNServer extends PersonalServer {
    constructor(session: Session);
    command(cmd: string, params: readonly string[]): void;
    protected motd(): void;
}
