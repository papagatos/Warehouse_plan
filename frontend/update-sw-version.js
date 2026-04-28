import { readFileSync, writeFileSync } from 'fs'
const version = new Date().toISOString().slice(0,16).replace(/[-T:]/g,'')
const sw = readFileSync('public/sw.js', 'utf8')
writeFileSync('public/sw.js', sw.replace(/warehouse-v[\w-]+/, `warehouse-v${version}`))
console.log(`SW version: warehouse-v${version}`)
