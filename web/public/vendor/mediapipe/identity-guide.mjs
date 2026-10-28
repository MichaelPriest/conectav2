// Conecta identity helper: expose only a local MediaPipe module on our origin.
import {FaceLandmarker,FilesetResolver} from './vision_bundle.mjs';
window.ConectaMediaPipe={FaceLandmarker,FilesetResolver};
