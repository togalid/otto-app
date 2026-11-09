import { edition } from './edition.js'

// Add a feature here when its availability differs between editions.
export const editionFeatures = {
  free: { stemSeparation: false },
  full: { stemSeparation: true },
}

export const features = editionFeatures[edition]
