/**
 * Shared FFmpeg filtergraph builders.
 *
 * Several producers need the same "fully transparent RGBA canvas" primitive —
 * either as the backdrop an item is overlaid onto, or as a leading gap before
 * an item starts. Keeping the chain in one place avoids the copy-paste that
 * previously lived in the video/image/text producers (and the subtle label
 * collisions that came with it).
 */

/**
 * Builds a fully-transparent RGBA source of the given size and duration.
 *
 * Emits a 3-filter chain:
 *   <prefix>-nullsrc -> <prefix>-nullsrc-format -> <outputName>
 *
 * `prefix` must be unique within the filtergraph so the intermediate pad
 * labels don't collide with another transparent source.
 */
export function createTransparentBg(
    prefix: string,
    w: number,
    h: number,
    duration: number | string,
    outputName: string
): DramaFilterforFFmpeg[] {
    return [
        {
            filter: 'nullsrc',
            options: {
                size: `${w}x${h}`,
                duration: `${duration}`
            },
            outputs: `${prefix}-nullsrc`
        },
        {
            inputs: `${prefix}-nullsrc`,
            filter: 'format',
            options: 'rgba',
            outputs: `${prefix}-nullsrc-format`
        },
        {
            inputs: `${prefix}-nullsrc-format`,
            filter: 'colorchannelmixer',
            options: {
                aa: 0
            },
            outputs: outputName
        }
    ];
}

/**
 * A leading fully-transparent gap, used when an item starts later than the
 * previous item on its layer ended. Returns `null` when there is no gap.
 *
 * The output pad is named `<id>-pbf`; its intermediate labels are namespaced
 * under `<id>-pbf-*` so they never collide with the item's own backdrop.
 */
export function createPreBlackFill(
    id: string,
    w: number,
    h: number,
    blackFillTime: number
): DramaFilterforFFmpeg[] | null {
    if (blackFillTime <= 0) return null;
    return createTransparentBg(`${id}-pbf`, w, h, blackFillTime, `${id}-pbf`);
}
