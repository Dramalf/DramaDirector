export function LogTask(commandLine, schema: DramaSchema) {
    let counter = {
        text: 0,
        image: 0,
        lottie: 0,
        video: 0,
        audio: 0
    };
    schema?.layers?.forEach((layer) => {
        layer?.items?.forEach((item) => {
            counter[item.type]++;
        });
    });
    // Diagnostic banner — write to stderr so callers that capture stdout
    // (the CLI, programmatic consumers piping into other tools) get clean output.
    console.error('[45m ============= FFMPEG TASK ============= [0m');
    console.error('[96m command line start:[0m');
    console.error(commandLine);
    console.error('[96m command line end [0m');
    console.error({
        duration: schema.d,
        width: schema.w,
        height: schema.h,
        ...counter,
    });
    console.error('[45m ============= FFMPEG TASK ============= [0m');
}
