import { Session } from "../Session";
import { PersonalServer  } from './PersonalServer';

export class NBNServer extends PersonalServer {
    constructor(session: Session){
        super(session);
    }

}