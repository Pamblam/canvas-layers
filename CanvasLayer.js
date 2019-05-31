class CanvasLayer{
	constructor(image, canvas, x=null, y=null, rotation=0){
		this.image = image;
		this.canvas = canvas;
		this.x = x === null ? canvas.width / 2 : x;
		this.y = y === null ? canvas.height / 2 : y;
		this.width = image.width;
		this.height = image.height;
		this.rotation = rotation;
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
	
}