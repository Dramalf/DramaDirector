const path=require('path')
// lottie from https://assets5.lottiefiles.com/temp/lf20_n16WIy.json by Changhyun Lee
const lottieDemo=require('./assets/lottie.json')
module.exports = {
    name: "mock",
    w: 750,
    h: 1000,
    d:14,
    layers: [
        {
            index: 0,
            type: 'audio',
            items: [
                {
                    url: path.join(__dirname,'assets','bgm.mp3'),
                    id: 'bgm',
                    type: 'audio',
                    config: {
                        seek: 4,
                        st: 0,
                        et: 14
                    },
                    effects:[
                        {
                            nm:'volume',
                            options:'+6dB'
                        }
                    ]
                }
            ]
        },
        {
            index: 1,
            type: 'audio',
            items: [

                {
                    url: path.join(__dirname,'assets',"tts1.wav"),
                    id: "tts1",
                    type: "audio",
                    config: {
                        st: 2,
                        et: 3,
                        seek: 0
                    },
                    effects: [
                        {
                            nm: 'volume',
                            options: '+10dB'
                        }
                    ]
                }, {
                    url:path.join(__dirname,'assets', "tts2.wav"),
                    id: "tts2",
                    type: "audio",
                    config: {
                        st: 3.5,
                        et: 4.25,
                        seek: 0
                    }
                    , effects: [
                        {
                            nm: 'volume',
                            options: '+16dB'
                        }
                    ]
                }
            ]
        },
        {
            index: 2,
            type: 'normal',
            items: [
                {
                    id: "v0",
                    url: path.join(__dirname,'assets','videoa.mp4'),
                    type: "video",
                    config: {
                        st: 0,
                        et: 5,
                        seek: 0,
                        x: '(main_w-w)/2',
                        y: '(main_h-h)/2'
                    },
                    effects: [
                        {
                            nm: "boxblur",
                            options: '20'
                        },
                        {
                            nm: 'scale',
                            options: {
                                w: -2,
                                h: 1000
                            }
                        },
                    ]
                },
                {
                    url: path.join(__dirname,'assets','videob.mp4'),
                    id: "v1",
                    type: "video",
                    config: {
                        st: 5,
                        et: 14,
                        seek: 0,
                        x: '(main_w-w)/2',
                        y: '(main_h-h)/2',
                        hasAudio: false
                    },
                    effects: [{
                        nm: "scale",
                        options: {
                            w: 750,
                            h: -2
                        }
                    }]
                },
            ]
        },
        {
            index: 3,
            type: "normal",
            items: [
                {
                    id: "v3",
                    url: path.join(__dirname,'assets','videoa.mp4'),
                    type: "video",
                    config: {
                        st: 0,
                        et: 5,
                        seek: 0,
                        x: '(main_w-w)/2',
                        y: '(main_h-h)/2'
                    },
                    effects: [
                        {
                            nm: 'scale',
                            options: {
                                w: 750,
                                h: -2
                            }
                        },
                    ]
                },
                {
                    id: "v4",
                    url: path.join(__dirname,'assets','videoc.mp4'),
                    type: "video",
                    config: {
                        st: 5,
                        et: 8,
                        seek: 3,
                        x: 0,
                        y: 100
                    },
                    effects: [
                        {
                            nm: 'scale',
                            options: {
                                w: 200,
                                h: -2
                            }
                        },
                    ]
                },
                {
                    id: "img0",
                    url: path.join(__dirname,'assets','logo.png'),
                    type: "image",
                    config: {
                        st: 8,
                        et: 14,
                        seek: 0,
                        x: 'main_w-90',
                        y: 10
                    },
                    effects: [
                        {
                            nm: "scale",
                            options: {
                                w: 80,
                                h: -2
                            }
                        },
                        {
                            nm:'format',
                            options:'rgba'
                        },
                        {
                            nm: "rotate",
                            options: {
                                angle:'2*PI*t',
                                c:'0x00000000'
                            }
                        }
                    ]
                },
            ]
        },
        {
            index: 4,
            type: 'text',
            items: [
                {
                    id: "t0",
                    type: "text",
                    config: {
                        text: "先展示高斯模糊效果",
                        st: 0,
                        et: 1.9,
                        x: '(w-text_w)/2',
                        fontcolor:'#000000',
                        bordercolor:'#ffffff',
                        borderw:3,
                        obw:4,
                        obc:'#bc7753',
                        y: 'h/6*5',
                        ttfPath: path.join(__dirname,'assets',"SmileySans-Oblique.ttf"),
                        fontsize: 'w*0.8/14'
                    }
                },
                {
                    id: "t1",
                    type: "text",
                    config: {
                        text: "很好的尝试",
                        st: 2,
                        et: 3,
                        x: '(w-text_w)/2',
                        y: 'h/6*5',
                        fontcolor:'#000000',
                        bordercolor:'#ffffff',
                        borderw:3,
                        obw:4,
                        obc:'#000000',
                        ttfPath: path.join(__dirname,'assets','SmileySans-Oblique.ttf'),
                        fontsize: 'w*0.8/14'
                    }
                },
                {
                    id: "t2",
                    type: "text",
                    config: {
                        text: "不错不错",
                        st: 3.5,
                        et: 4.25,
                        x: '(w-text_w)/2',
                        y: 'h/6*5',
                        fontcolor:'#00ff75',
                        bordercolor:'#ffffff',
                        borderw:3,
                        obw:4,
                        obc:'#acf453',
                        ttfPath: path.join(__dirname,'assets','SmileySans-Oblique.ttf'),
                        fontsize: 'w*0.8/14'
                    }
                },
                {
                    id: "t3",
                    type: "text",
                    config: {
                        text: "注意到lottie动画了吗",
                        st: 3.7,
                        et: 6.7,
                        x: '(w-text_w)/2',
                        y: 'h/2',
                        fontcolor:'#000000',
                        bordercolor:'#b73eff',
                        borderw:3,
                        obw:4,
                        obc:'#000000',
                        ttfPath: path.join(__dirname,'assets','SmileySans-Oblique.ttf'),
                        fontsize: 'w*0.8/14'
                    }
                },
                {
                    id: "t3",
                    type: "text",
                    config: {
                        text: "很丑的画中画，谁懂啊",
                        st: 5,
                        et: 8,
                        x: '(w-text_w)/2',
                        y: '200-text_h',
                        fontcolor:'#bbe675',
                        bordercolor:'#ffffff',
                        borderw:3,
                        obw:4,
                        obc:'#c3f471',
                        ttfPath: path.join(__dirname,'assets','SmileySans-Oblique.ttf'),
                        fontsize: 'w*0.8/14'
                    }
                },
                {
                    id: "t3",
                    type: "text",
                    config: {
                        text: "看看西湖美景吧家人们",
                        st: 8.7,
                        et: 14,
                        x: '(w-text_w)/2',
                        y: 'h/6*5',
                        fontcolor:'#00ff75',
                        bordercolor:'#3f66f4',
                        borderw:3,
                        obw:4,
                        obc:'#acf453',
                        ttfPath: path.join(__dirname,'assets','SmileySans-Oblique.ttf'),
                        fontsize: 'w*0.8/14'
                    }
                },
                {
                    id: "t3",
                    type: "text",
                    config: {
                        text: "这里有个logo哦=>",
                        st: 8,
                        et: 10,
                        x: '(w-text_w)/2',
                        y: 50,
                        fontcolor:'#bbe675',
                        bordercolor:'#ffffff',
                        borderw:3,
                        obw:4,
                        obc:'#000000',
                        ttfPath: path.join(__dirname,'assets','SmileySans-Oblique.ttf'),
                        fontsize: 'w*0.8/14'
                    }
                }
            ]
        },
        {
            type: 'lottie',
            index: 5,
            items: [
                {
                    type: 'lottie',
                    lottie: lottieDemo,
                    config: {
                        x: 0, y: 0, st: 3, et: 7, fps: 60, w: 750, h: 1000, seek: 0
                    }
                }
            ]
        }
    ]
} 