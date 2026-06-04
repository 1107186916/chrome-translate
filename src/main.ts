import './components/ct-ball'
import './components/ct-selection'
import './components/ct-translate-panel'

const ballEl = document.createElement('chrome-translate-ball')
document.documentElement.appendChild(ballEl)

const selectionEl = document.createElement('chrome-translate-selection')
document.documentElement.appendChild(selectionEl)

const panelEl = document.createElement('chrome-translate-panel')
document.documentElement.appendChild(panelEl)
