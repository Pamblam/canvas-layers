
class CanvasFonts{}

CanvasFonts.getNative = async (force_recheck = false) => {
	
	if(CanvasFonts._native_available.length && !force_recheck){
		return CanvasFonts._native_available;
	}

	var _native_available = [];
	await document.fonts.ready;
	CanvasFonts._native_fontlist.forEach(font => {
		if (document.fonts.check(`12px "${font}"`)) {
			_native_available.push(font);
		}
	})

	CanvasFonts._native_available = [...new Set(_native_available)].sort();
	return CanvasFonts._native_available;
};

CanvasFonts.getDownloaded = async (force_recheck = false) => {
	if(CanvasFonts._downloaded_available.length && !force_recheck){
		return CanvasFonts._downloaded_available;
	}
	
	let {fonts} = document;
	const it = fonts.entries();

	let arr = [];
	let done = false;

	while (!done) {
		const font = it.next();
		if (!font.done) {
			
			var family;
			try{
				family = JSON.parse(font.value[0].family);
			}catch(e){
				family = font.value[0].family;
			}
			
			arr.push(family);
		} else {
			done = font.done;
		}
	}
	
	CanvasFonts._downloaded_available = [...new Set(arr)].sort();
	return CanvasFonts._downloaded_available;
};

CanvasFonts.getAvailable = async () => {
	var native = await CanvasFonts.getNative();
	var downloaded = await CanvasFonts.getDownloaded();
	return [...new Set([...native, ...downloaded])].sort();
};

CanvasFonts._native_available = [];
CanvasFonts._downloaded_available = [];