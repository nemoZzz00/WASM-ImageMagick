/**
 * Base class for ImageMagick input and output files.
 */
export interface MagickFile {
  name: string
}

/**
 * Represents output files generated when an ImageMagick command executes.
 */
export interface MagickOutputFile extends MagickFile {
  blob: Blob
}

/**
 * Represents input files that need to be provided to {@link call} or [execute](https://github.com/KnicKnic/WASM-ImageMagick/tree/sample-sinteractive-/apidocs#execute).
 * 
 * Can be builded using {@link buildInputFile}
 */
export interface MagickInputFile extends MagickFile {
  content: Uint8Array
}

/**
 * {@link call} shortcut that only returns the output files.
 */
export async function Call(inputFiles: MagickInputFile[], command: string[]): Promise<MagickOutputFile[]> {
  const result = await call(inputFiles, command)
  return result.outputFiles
}

/**
 * The result of calling {@link call}. Also the base class of results of calling [execute](https://github.com/KnicKnic/WASM-ImageMagick/tree/sample-sinteractive-/apidocs#execute).
 */
export interface CallResult {
  /**
   * Output files generated by the command, if any
   */
  outputFiles: MagickOutputFile[]
  /**
   * Output printed by the command to stdout. For example the command `identify rose:` will print useful information to stdout
   */
  stdout: string[]
  /**
   * Output printed by the command to stderr. If `exitCode != 0` then this property could have some information about the error.
   */
  stderr: string[]
  /**
   * Exit code of the command executed. If 0 the command executed successfully, otherwise an error occurred and `stderr` could have some information about what was wrong
   */
  exitCode: number
}

/**
 * Low level execution function. All the other functions like [execute](https://github.com/KnicKnic/WASM-ImageMagick/tree/sample-sinteractive-/apidocs#execute) ends up calling this one. It accept only one command and only in the form of array of strings.
 */
export function call(inputFiles: MagickInputFile[], command: string[]): Promise<CallResult> {
  const request = {
    files: inputFiles,
    args: command,
    requestNumber: magickWorkerPromisesKey,
  }
  const promise = CreatePromiseEvent()
  magickWorkerPromises[magickWorkerPromisesKey] = promise
  magickWorker.postMessage(request)
  magickWorkerPromisesKey++
  return promise as Promise<CallResult>
}

function CreatePromiseEvent() {
  let resolver
  let rejecter
  const emptyPromise = new Promise((resolve, reject) => {
    resolver = resolve
    rejecter = reject
  }) as Promise<{}> & { resolve?: any, reject?: any }
  emptyPromise.resolve = resolver
  emptyPromise.reject = rejecter
  return emptyPromise
}

const magickWorker = new Worker('magick.js')

const magickWorkerPromises = {}
let magickWorkerPromisesKey = 1

// handle responses as they stream in after being outputFiles by image magick
magickWorker.onmessage = e => {
  const response = e.data
  const promise = magickWorkerPromises[response.requestNumber]
  delete magickWorkerPromises[response.requestNumber]
  const result = {
    outputFiles: response.outputFiles,
    stdout: response.stdout,
    stderr: response.stderr,
    exitCode: response.exitCode || 0,
  }
  promise.resolve(result)
}
