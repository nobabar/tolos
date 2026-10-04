import {
  FIXED_BLOOM_SPIKE_SEEDS,
  buildBloomSpikeProgram,
  disposeBloomSpikeProgram,
  paintBloomSpike,
} from './bloom-spike-paint'

const WIDTH = 960
const HEIGHT = 540

type DialState = {
  seed: string
  softness: number
  grain: number
  energy: number
}

const state: DialState = {
  seed: FIXED_BLOOM_SPIKE_SEEDS[0],
  softness: 0.45,
  grain: 0.35,
  energy: 0.55,
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`missing #${id}`)
  return node as T
}

function main(): void {
  const canvas = el<HTMLCanvasElement>('stage')
  canvas.width = WIDTH
  canvas.height = HEIGHT

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  })
  if (!gl) {
    el<HTMLElement>('status').textContent = 'WebGL2 unavailable'
    return
  }

  const spike = buildBloomSpikeProgram(gl)
  if (!spike) {
    el<HTMLElement>('status').textContent = 'Spike program failed to compile/link'
    return
  }

  const seedSelect = el<HTMLSelectElement>('seed')
  for (const seed of FIXED_BLOOM_SPIKE_SEEDS) {
    const opt = document.createElement('option')
    opt.value = seed
    opt.textContent = seed
    seedSelect.appendChild(opt)
  }
  seedSelect.value = state.seed

  const soft = el<HTMLInputElement>('softness')
  const grain = el<HTMLInputElement>('grain')
  const energy = el<HTMLInputElement>('energy')
  soft.value = String(state.softness)
  grain.value = String(state.grain)
  energy.value = String(state.energy)

  const softOut = el<HTMLElement>('softness-out')
  const grainOut = el<HTMLElement>('grain-out')
  const energyOut = el<HTMLElement>('energy-out')

  const ctx = gl
  const program = spike

  function paint(): void {
    state.seed = seedSelect.value
    state.softness = Number(soft.value)
    state.grain = Number(grain.value)
    state.energy = Number(energy.value)
    softOut.textContent = state.softness.toFixed(2)
    grainOut.textContent = state.grain.toFixed(2)
    energyOut.textContent = state.energy.toFixed(2)
    paintBloomSpike(ctx, program, {
      seed: state.seed,
      width: WIDTH,
      height: HEIGHT,
      softness: state.softness,
      grain: state.grain,
      energy: state.energy,
    })
    el<HTMLElement>('status').textContent =
      `seed=${state.seed}  soft=${state.softness.toFixed(2)}  grain=${state.grain.toFixed(2)}  energy=${state.energy.toFixed(2)}`
  }

  seedSelect.addEventListener('change', paint)
  soft.addEventListener('input', paint)
  grain.addEventListener('input', paint)
  energy.addEventListener('input', paint)

  el<HTMLButtonElement>('calm').addEventListener('click', () => {
    soft.value = '0.85'
    energy.value = '0.2'
    paint()
  })
  el<HTMLButtonElement>('structure').addEventListener('click', () => {
    soft.value = '0.2'
    energy.value = '0.9'
    paint()
  })

  window.addEventListener('beforeunload', () => {
    disposeBloomSpikeProgram(gl, spike)
  })

  paint()
}

main()
