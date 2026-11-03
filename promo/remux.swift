// remux.swift — replace the soundtrack of an MP4 without re-rendering the picture.
// Usage: swift remux.swift <in.mp4> <audio.m4a> <out.mp4>
import AVFoundation
let a = CommandLine.arguments
let video = AVURLAsset(url: URL(fileURLWithPath: a[1])), audio = AVURLAsset(url: URL(fileURLWithPath: a[2]))
let comp = AVMutableComposition()
let vt = video.tracks(withMediaType: .video)[0], at = audio.tracks(withMediaType: .audio)[0]
let range = CMTimeRange(start: .zero, duration: video.duration)
try! comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!.insertTimeRange(range, of: vt, at: .zero)
try! comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!.insertTimeRange(CMTimeRange(start: .zero, duration: min(video.duration, audio.duration)), of: at, at: .zero)
let out = URL(fileURLWithPath: a[3]); try? FileManager.default.removeItem(at: out)
let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough)!
ex.outputURL = out; ex.outputFileType = .mp4
let sem = DispatchSemaphore(value: 0); ex.exportAsynchronously { sem.signal() }; sem.wait()
print(ex.status == .completed ? "wrote \(a[3])" : "failed: \(String(describing: ex.error))")
