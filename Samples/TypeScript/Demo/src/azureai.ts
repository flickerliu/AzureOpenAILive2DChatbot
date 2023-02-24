import { LAppPal } from "./lapppal";
import { getWaveBlob } from "webm-to-wav-converter";
import { LANGUAGE_TO_VOICE_MAPPING_LIST } from "./languagetovoicemapping";

export let txtSubtitle: HTMLSpanElement = null;
export let divSubtitle: HTMLElement = null;

export class AzureAi {
  private _openaiurl: string;
  private _openaipikey: string;
  private _ttsapikey: string;
  private _ttsregion: string;

  private _inProgress: boolean;

  constructor() {
    txtSubtitle = document.getElementById("txtSubtitle");
    divSubtitle = document.getElementById("divSubtitle");

    //const config = (document.getElementById("config") as any).value;
    const config = "{\"openaiurl\":\"\",\"openaipikey\":\"\",\"ttsregion\":\"\",\"ttsapikey\":\"\"}";
    
    //if (config !== "") {
    const json = JSON.parse(config);
    this._openaiurl = json.openaiurl;
    this._openaipikey = json.openaipikey;
    this._ttsregion = json.ttsregion;
    this._ttsapikey = json.ttsapikey;
    //}

    this._inProgress = false;
  }

  async getOpenAiAnswer(prompt: string) {

    if (this._openaiurl === undefined || this._inProgress || prompt === "") return "";

    this._inProgress = true;

    const conversations = (document.getElementById("conversations") as any).value;
    LAppPal.printMessage(prompt);
    divSubtitle.setAttribute("style", "display: block;");
    //txtSubtitle.innerText = prompt;
    txtSubtitle.innerHTML = `<span class=\"question-text\">${prompt}</span><br />`;

    const conversation = conversations + "\n\n## " + prompt
    const m = {
      "prompt": `##${conversation}\n\n`,
      "max_tokens": 300,
      "temperature": 0,
      "frequency_penalty": 0,
      "presence_penalty": 0,
      "top_p": 1,
      "stop": ["#", ";"]
    }

    const repsonse = await fetch(this._openaiurl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this._openaipikey,
      },
      body: JSON.stringify(m)
    });
    const json = await repsonse.json();
    let answer: string = json.choices[0].text;

    const newLine2 = "\n\n";
    const newLine2Index = answer.indexOf(newLine2);
    if (newLine2Index > -1) {
      answer = answer.substring(newLine2Index + 1);
    }

    LAppPal.printMessage(answer);
    (document.getElementById("reply") as any).value = answer;
    (document.getElementById("conversations") as any).value = conversations + "\n\n" + answer;

    return answer;
  }

  async getSpeechUrl(language: string, text: string) {

    if (this._ttsregion === undefined) return;

    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set('Content-Type', 'application/ssml+xml');
    requestHeaders.set('X-Microsoft-OutputFormat', 'riff-8khz-16bit-mono-pcm');
    requestHeaders.set('Ocp-Apim-Subscription-Key', this._ttsapikey);

    const voice = LANGUAGE_TO_VOICE_MAPPING_LIST.find(c => c.voice.startsWith(language) && c.IsMale === false).voice;

    const ssml = `
<speak version=\'1.0\' xml:lang=\'${language}\'>
  <voice xml:lang=\'${language}\' xml:gender=\'Female\' name=\'${voice}\'>
    ${text}
  </voice>
</speak>`;

      var fetchurl = `https://${this._ttsregion}.tts.speech.microsoft.com/cognitiveservices/v1`;
      if (this._ttsregion.includes("china"))
      {
        //china azure endpoint
        fetchurl = `https://${this._ttsregion}.tts.speech.azure.cn/cognitiveservices/v1`;
      }

      const response = await fetch(fetchurl, {
      method: 'POST',
      headers: requestHeaders,
      body: ssml
    });

    const blob = await response.blob();

    var url = window.URL.createObjectURL(blob)
    const audio: any = document.getElementById('voice');
    audio.src = url;
    LAppPal.printMessage(`Load Text to Speech url`);
    //txtSubtitle.innerText += "\n" + text;
    txtSubtitle.innerHTML += `<span class=\"answer-text\">${text}</span>`;
    this._inProgress = false;
    return url;
  }

  async getTextFromSpeech(language: string, data: Blob) {
    if (this._ttsregion === undefined) return "";

    LAppPal.printMessage(language);
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set('Accept', 'application/json;text/xml');
    requestHeaders.set('Content-Type', 'audio/wav; codecs=audio/pcm; samplerate=16000');
    requestHeaders.set('Ocp-Apim-Subscription-Key', this._ttsapikey);

    const wav = await getWaveBlob(data, false);

    var fetchurl = `https://${this._ttsregion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;
    if (this._ttsregion.includes("china"))
    {
      //china azure endpoint
      fetchurl = `https://${this._ttsregion}.stt.speech.azure.cn/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;
    }

    const response = await fetch(fetchurl, {
      method: 'POST',
      headers: requestHeaders,
      body: wav
    });

    const json = await response.json();
    return json.DisplayText;
  }
}
