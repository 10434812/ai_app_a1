import {randomBytes, randomUUID} from 'node:crypto'

export const createSecureToken = (size = 8) => {
  return randomBytes(size).toString('hex').toUpperCase()
}

export const createSecureId = () => {
  return typeof randomUUID === 'function' ? randomUUID() : randomBytes(16).toString('hex')
}

export const createSecureNonce = (size = 16) => {
  return randomBytes(size).toString('hex')
}
