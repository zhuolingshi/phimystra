"use strict"
var __importDefault = (this && this.__importDefault) || function (mod) { return (mod && mod.__esModule) ? mod : { "default": mod } }
const path = require('path')
const fs = require('fs')
const os = require('os')
const child_process = require('child_process')

const hvigorConfigPath = path.join(__dirname, 'hvigor-config.json5')
const projectRoot = path.dirname(path.dirname(__filename))
const hvigorWrapperBasePath = path.join(os.homedir(), '.hvigor', 'project_caches')

function readHvigorVersion() {
    try {
        const content = fs.readFileSync(hvigorConfigPath, 'utf-8')
        const match = content.match(/"hvigorVersion"\s*:\s*"([^"]+)"/)
        return match ? match[1] : '5.0.0'
    } catch {
        return '5.0.0'
    }
}

function getHvigorCachePath(version) {
    return path.join(hvigorWrapperBasePath, version)
}

function ensureHvigorInstalled(version) {
    const cachePath = getHvigorCachePath(version)
    const hvigorEntry = path.join(cachePath, 'node_modules', '@ohos', 'hvigor', 'bin', 'hvigor.js')
    if (fs.existsSync(hvigorEntry)) return hvigorEntry

    fs.mkdirSync(cachePath, { recursive: true })
    const pkgJson = { name: 'hvigor-project-cache', version: '1.0.0', dependencies: {} }
    pkgJson.dependencies['@ohos/hvigor'] = version
    fs.writeFileSync(path.join(cachePath, 'package.json'), JSON.stringify(pkgJson, null, 2))

    child_process.execSync('npm install --no-package-lock --no-audit --prefer-offline', {
        cwd: cachePath,
        stdio: 'inherit'
    })
    return hvigorEntry
}

function main() {
    const version = readHvigorVersion()
    const hvigorEntry = ensureHvigorInstalled(version)
    const args = process.argv.slice(2)
    args.push('-p', 'project=' + projectRoot, '-p', 'hvigorWrapper=' + __dirname)
    const result = child_process.spawnSync('node', [hvigorEntry, ...args], {
        stdio: 'inherit',
        cwd: projectRoot
    })
    process.exit(result.status || 0)
}

main()
