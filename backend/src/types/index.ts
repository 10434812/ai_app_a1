import {User as UserModel} from '../models/User.js'

export type User = UserModel

export interface AuthRequest extends Express.Request {
  user?: User
}
