import chalk from 'chalk'

const timestamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false })

export const logger = {
  info: (msg: string) => console.log(`${timestamp()} ℹ  ${msg}`),
  warn: (msg: string) => console.log(`${timestamp()} ⚠  ${chalk.yellow(msg)}`),
  error: (msg: string) => console.error(`${timestamp()} ✖  ${chalk.red(msg)}`),
  success: (msg: string) => console.log(`${timestamp()} →  ${chalk.green(msg)}`),
}
