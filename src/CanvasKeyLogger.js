class CanvasKeyLogger{

	constructor(options){

		// The element to attach the listener to.
		this.element = options.element || document;

		// An array of characters that represent keys pressed
		this.input = [];

		// The current cursor position in the input array
		this.cursor_pos = 0;

		// Flag to indicate if the keylogger is logging keys or not
		this.enabled = false;

		// What event type to use for logging
		this.event_type = options.event_type || 'keydown';

		// The event handler that does all the work...
		this._key_event_handler = this.key_event_handler.bind(this);

		// Various optional user specified event listeners
		this.on_input = (options.on_input || function(){}).bind(this);
		this.on_nav_key = (options.on_nav_key || function(){}).bind(this);

		// If there is an autostart option set to false, don't start logging immediately
		if(!options.hasOwnProperty('autostart') || options.autostart !== false){
			this.enable();
		}

	}

	key_event_handler(e){

		if(CanvasKeyLogger.NAMED_INPUT_KEYS[e.key]){
			input.splice(this.cursor_pos, 0, CanvasKeyLogger.NAMED_INPUT_KEYS[e.key]);
			this.cursor_pos++;
			this.on_input();
		}

		else if(CanvasKeyLogger.CONTROL_KEYS.includes(e.key)){
			switch(e.key){

				case 'ArrowDown': 
					this.on_nav_key();
					break;

				case 'ArrowLeft':
					if(this.cursor_pos > 0){
						this.cursor_pos--;
					}
					this.on_nav_key();
					break;

				case 'ArrowRight':
					if(this.input.length > this.cursor_pos){
						this.cursor_pos++;
					}
					this.on_nav_key();
					break;

				case 'ArrowUp':
					this.on_nav_key();
					break;

				case 'End':
					this.cursor_pos = this.input.length - 1;
					this.on_nav_key();
					break;

				case 'Home':
					this.cursor_pos = 0;
					this.on_nav_key();
					break;

				case 'Backspace':
					if(this.cursor_pos > 0){
						this.input.splice(this.cursor_pos-1, 1);
						this.cursor_pos--;
						this.on_input();
					}
					break;

				case 'Delete':
					if(this.input.length > this.cursor_pos){
						this.input.splice(this.cursor_pos, 1);
						this.on_input();
					}
					break;

			}
		}

		else if(!CanvasKeyLogger.NON_INPUT_KEYS.includes(e.key)){
			this.input.splice(this.cursor_pos, 0, e.key);
			this.cursor_pos++;
			this.on_input();
		}
	}

	val(as_array=false, cursor='CURSOR'){
		if(as_array){
			var value = [], i;
			for(i=0; i < this.input.length; i++){
				if(i == this.cursor_pos) value.push(cursor);
				value.push(this.input[i]);
			}
			if(i == this.cursor_pos) value.push(cursor);
			return value;
		}else{
			return this.input.join('');
		}
	}

	enable(){
		this.enabled = true;
		this.element.addEventListener(this.event_type, this._key_event_handler);
	}

	disable(){
		this.enabled = false;
		this.element.removeEventListener(this.event_type, this._key_event_handler);
	}

}

CanvasKeyLogger.NAMED_INPUT_KEYS = {Enter: "\n", Tab: "\t"};

CanvasKeyLogger.CONTROL_KEYS = ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp',
	'End', 'Home', 'Backspace', 'Delete'];

CanvasKeyLogger.NON_INPUT_KEYS = ['Unidentified', 'Alt', 'AltGraph', 'CapsLock', 'Control',
	'Fn', 'FnLock', 'Hyper', 'Meta', 'NumLock', 'ScrollLock', 'Shift', 'Super',
	'Symbol', 'SymbolLock', 'PageDown', 'PageUp', 'Clear', 'Copy', 'CrSel',
	'Cut', 'EraseEof', 'ExSel', 'Insert', 'Paste', 'Redo', 'Undo', 'Accept',
	'Again', 'Attn', 'Cancel', 'ContextMenu', 'Escape', 'Execute', 'Find',
	'Finish', 'Help', 'Pause', 'Play', 'Props', 'Select', 'ZoomIn', 'ZoomOut',
	'BrightnessDown', 'BrightnessUp', 'Eject', 'LogOff', 'Power', 'PowerOff',
	'PrintScreen', 'Hibernate', 'Standby', 'WakeUp', 'AllCandidates', 'Alphanumeric',
	'CodeInput', 'Compose', 'Convert', 'Dead', 'FinalMode', 'GroupFirst', 'GroupLast',
	'GroupNext', 'GroupPrevious', 'ModeChange', 'NextCandidate', 'NonConvert',
	'PreviousCandidate', 'Process', 'SingleCandidate', 'HangulMode', 'HanjaMode',
	'JunjaMode', 'Eisu', 'Hankaku', 'Hiragana', 'HiraganaKatakana', 'KanaMode',
	'KanjiMode', 'Katakana', 'Romaji', 'Zenkaku', 'ZenkakuHanaku', 'F1',
	'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
	'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'Soft1', 'Soft2',
	'Soft3', 'Soft4', 'AppSwitch', 'Call', 'Camera', 'CameraFocus', 'EndCall',
	'GoBack', 'GoHome', 'HeadsetHook', 'LastNumberRedial', 'Notification',
	'MannerMode', 'VoiceDial', 'ChannelDown', 'ChannelUp', 'MediaFastForward',
	'MediaPause', 'MediaPlay', 'MediaPlayPause', 'MediaRecord', 'MediaRewind',
	'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious', 'AudioBalanceLeft',
	'AudioBalanceRight', 'AudioBassDown', 'AudioBassBoostDown', 'AudioBassBoostToggle',
	'AudioBassBoostUp', 'AudioBassUp', 'AudioFaderFront', 'AudioFaderRear',
	'AudioSurroundModeNext', 'AudioTrebleDown', 'AudioTrebleUp', 'AudioVolumeDown',
	'AudioVolumeMute', 'AudioVolumeUp', 'MicrophoneToggle', 'MicrophoneVolumeDown',
	'MicrophoneVolumeMute', 'MicrophoneVolumeUp', 'TV', 'TV3DMode', 'TVAntennaCable',
	'TVAudioDescription', 'TVAudioDescriptionMixDown', 'TVAudioDescriptionMixUp',
	'TVContentsMenu', 'TVDataService', 'TVInput', 'TVInputComponent1', 'TVInputComponent2',
	'TVInputComposite1', 'TVInputComposite2', 'TVInputHDMI1', 'TVInputHDMI2',
	'TVInputHDMI3', 'TVInputHDMI4', 'TVInputVGA1', 'TVMediaContext', 'TVNetwork',
	'TVNumberEntry', 'TVPower', 'TVRadioService', 'TVSatellite', 'TVSatelliteBS',
	'TVSatelliteCS', 'TVSatelliteToggle', 'TVTerrestrialAnalog', 'TVTerrestrialDigital',
	'TVTimer', 'AVRInput', 'AVRPower', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow',
	'ColorF3Blue', 'ColorF4Grey', 'ColorF5Brown', 'ClosedCaptionToggle',
	'Dimmer', 'DisplaySwap', 'DVR', 'Exit', 'FavoriteClear0', 'FavoriteClear1',
	'FavoriteClear2', 'FavoriteClear3', 'FavoriteRecall0', 'FavoriteRecall1',
	'FavoriteRecall2', 'FavoriteRecall3', 'FavoriteStore0', 'FavoriteStore1',
	'FavoriteStore2', 'FavoriteStore3', 'Guide', 'GuideNextDay', 'GuidePreviousDay',
	'Info', 'InstantReplay', 'Link', 'ListProgram', 'LiveContent', 'Lock',
	'MediaApps', 'MediaAudioTrack', 'MediaLast', 'MediaSkipBackward', 'MediaSkipForward',
	'MediaStepBackward', 'MediaStepForward', 'MediaTopMenu', 'NavigateIn',
	'NavigateNext', 'NavigateOut', 'NavigatePrevious', 'NextFavoriteChannel',
	'NextUserProfile', 'OnDemand', 'Pairing', 'PinPDown', 'PinPMove', 'PinPToggle',
	'PinPUp', 'PlaySpeedDown', 'PlaySpeedReset', 'PlaySpeedUp', 'RandomToggle',
	'RcLowBattery', 'RecordSpeedNext', 'RfBypass', 'ScanChannelsToggle',
	'ScreenModeNext', 'Settings', 'SplitScreenToggle', 'STBInput', 'STBPower',
	'Subtitle', 'Teletext', 'VideoModeNext', 'Wink', 'ZoomToggle', 'SpeechCorrectionList',
	'SpeechInputToggle', 'Close', 'New', 'Open', 'Print', 'Save', 'SpellCheck',
	'MailForward', 'MailReply', 'MailSend', 'LaunchCalculator', 'LaunchCalendar',
	'LaunchContacts', 'LaunchMail', 'LaunchMediaPlayer', 'LaunchMusicPlayer',
	'LaunchMyComputer', 'LaunchPhone', 'LaunchScreenSaver', 'LaunchSpreadsheet',
	'LaunchWebBrowser', 'LaunchWebCam', 'LaunchWordProcessor', 'LaunchApplication1',
	'LaunchApplication2', 'LaunchApplication3', 'LaunchApplication4', 'LaunchApplication5',
	'LaunchApplication6', 'LaunchApplication7', 'LaunchApplication8', 'LaunchApplication9',
	'LaunchApplication10', 'LaunchApplication11', 'LaunchApplication12', 'LaunchApplication13',
	'LaunchApplication14', 'LaunchApplication15', 'LaunchApplication16', 'BrowserBack',
	'BrowserFavorites', 'BrowserForward', 'BrowserHome', 'BrowserRefresh', 'BrowserSearch',
	'BrowserStop', 'Decimal', 'Key11', 'Key12', 'Multiply', 'Add', 'Clear',
	'Divide', 'Subtract', 'Separator'
];