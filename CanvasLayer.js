class CanvasLayer{
	constructor(url, name, x, y, width=null, height=null,rotation=0, draggable=true, rotateable=true, resizable=true, selectable=true){
		this.name = name;
		this.url = url;
		this.ready = false;
		this.image = null;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.rotation = rotation;
		this.draggable = draggable;
		this.rotateable = rotateable;
		this.resizable = resizable;
		this.selectable = selectable;
		this.load_cb_stack = [];
	}
	
	onload(fn){
		if(this.ready){
			fn();
			return;
		}else{
			this.load_cb_stack.push(fn);
		}
	}
	
	getCorners(relativeToCenter=false){
		return relativeToCenter ? [
			{x:-(this.width/2), y:-(this.height/2)},
			{x:-(this.width/2)+this.width, y:-(this.height/2)},
			{x:-(this.width/2)+this.width, y:-(this.height/2)+this.height},
			{x:-(this.width/2), y:-(this.height/2)+this.height}
		] : [
			{x:this.x-(this.width/2), y:this.y-(this.height/2)},
			{x:this.x-(this.width/2)+this.width, y:this.y-(this.height/2)},
			{x:this.x-(this.width/2)+this.width, y:this.y-(this.height/2)+this.height},
			{x:this.x-(this.width/2), y:this.y-(this.height/2)+this.height}
		];
	}
	
	load(){
		return new Promise(done=>{
			if(this.ready) return done();
			const img = new Image();
			img.onload = ()=>{
				this.image = img;
				this.ready = true;
				if(this.width===null) this.width = img.width;
				if(this.height===null) this.height = img.height;
				this.load_cb_stack.forEach(fn=>fn());
				this.load_cb_stack = [];
				done();
			};
			img.src = this.url;
		});
	}
	
}