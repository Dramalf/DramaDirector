import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import FfmpegCommand from 'fluent-ffmpeg';
FfmpegCommand.setFfmpegPath(ffmpegPath.path);
import { generateItemProducer, generateMultiLayerProducer, generateSingleLayerProducer } from '../Producer'
import DramaObserver from "./observer";
import { LogTask } from '../Utils/tipsLog'
export default class DramaCore extends DramaObserver {
    constructor(schema: DramaSchema) {
        super(schema);
    }
    produce() {
        this.layers.forEach(layer => {
            layer?.items?.forEach(item => {
                item.producer = generateItemProducer(item);
            })
            layer.producer = generateSingleLayerProducer(layer)
        })
    }
    consume(): FfmpegCommand.FfmpegCommand {
        const command = FfmpegCommand();
        const inputs = this.getInputs();
        const filters = this.getFilters();
        inputs.forEach(input => {
            command.addInput(input.url)
                .inputOptions(input.inputOptions)
        });
        command.complexFilter(filters,
            [
                DramaObserver.baseInfo.outv,
                DramaObserver.baseInfo.outa,
            ].filter(Boolean));


        // command.on('stderr', console.log)
        command.on('start', (commandLine) => {
            LogTask(commandLine, this.schema);
        })
        return command;



    }
    getInputs(): DramaInputForFFmpeg[] {
        const inputs = [];
        this.layers?.forEach(layer => {
            if (layer.type === 'text') return
            if (layer.type === 'lottie') {
                inputs.push({
                    inputOptions: layer.producer.getInputOptions(),
                    url: layer.producer.getStream()
                })
                return
            }
            layer?.items.forEach(item => {
                inputs.push({
                    inputOptions: item.producer.getInputOptions(),
                    url: item.url
                })
            })
        })
        return inputs
    }
    getFilters(): DramaFilterforFFmpeg[] {
        const filters = [];
        this.layers?.forEach(layer => {
            layer?.items.forEach(item => {
                if (item?.type !== 'text') {
                    filters.push(...item.producer.getFilters());
                }
            })
            filters.push(...layer.producer.getFilters());
        })
        filters.push(...generateMultiLayerProducer(this.layers).getFilters())
        return filters.filter(filterItem => filterItem)
    }

    getStream() {
        this.produce();
        const command = this.consume();
        command.outputOptions([
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov'
        ]);
        return command.pipe();
    }
    async save(path: string): Promise<{ success: boolean, error?: string }> {
        this.produce();
        const command = await this.consume();
        command.outputOptions([
            '-ss', '0', '-t', `${DramaObserver.baseInfo.d}`,
            '-c:v', 'libx264',
            '-threads', '8',
            '-crf', '18',
            '-preset', 'veryfast',
            '-f', 'mp4',
        ])
        return new Promise((resolve, reject) => {
            command
                .on('end', () => {
                    resolve({ success: true })
                })
                .on('error', (err) => {
                    reject({ success: false, error: err.toString() })
                })
                .save(path)
        })

    }
}
