import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

const {Cube, Axis_Arrows, Textured_Phong, Square} = defs

export class Fishing extends Scene {
    /**
     *  **Base_scene** is a Scene that can be added to any display canvas.
     *  Setup the shapes, materials, camera, and lighting here.
     */
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();
        
        this.shapes = {
            box_1: new Cube(),
            box_2: new Cube(),
            axis: new Axis_Arrows(),
            plane: new Square(),
            raft: new Shape_From_File("assets/raft.obj"),
            text: new Text_Line(15),
            Island: new Shape_From_File("assets/island.obj"),
            Shipwreck: new Shape_From_File("assets/shipwreck.obj"),
            Barrier: new Shape_From_File("assets/mts.obj"),
            Fish: new Shape_From_File("assets/fish.obj"),
            FishingCircle: new defs.Subdivision_Sphere(4),
        }

        this.materials = {
            phong: new Material(new Textured_Phong(), {
                color: hex_color("#ffffff"),
            }),
            ocean: new Material(new Texture_Scroll_X(), {
                color: hex_color("#037bfc"),
                ambient: 0.5, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/water.png")
            }),
            wood: new Material(new defs.Fake_Bump_Map(1), {
                color: color(0.643, 0.455, 0.286, 1),
                ambient: 0.4,
                diffusivity: 0.25,
                specularity: 0.25,
                texture: new Texture("assets/wood.jpg"),
            }),
            text_image: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/text.png")
            }),
            island: new Material(new defs.Textured_Phong(1), {
               ambient: 1,
               texture: new Texture("assets/islandAtlas.png")
            }),
            shipwreck: new Material(new defs.Textured_Phong(1), {
                ambient: 1,
                texture: new Texture("assets/shipwreckAtlas.png")
            }),
            barrier: new Material(new defs.Textured_Phong(1), {
                ambient: 1,
                texture: new Texture("assets/mts.png")
            }),
            fish: new Material(new defs.Textured_Phong(1), {
                ambient: .5,
                texture: new Texture("assets/fish.png"),
                color: hex_color("#ffffff"),
            }),
            fishing_circle: new Material(new Ring_Shader(), {
                ambient: .5, specularity: 0, diffusivity: 0.5, color: hex_color("#42f5ad")
            }),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 25, 15), vec3(0, 0, 0), vec3(0, 1, 0));

        this.key = null;
        this.speed = 0;
        this.max_speed = .05;
        this.boatRad = .5;
        this.fishing_radius = 4;
        this.fish_time = 3;
        this.initial_boat_transform = Mat4.identity().times(Mat4.translation(0, -.32, 0)).times(Mat4.scale(.5, .5, .5)).times(Mat4.rotation(Math.PI / 2, 0, 1, 0)).times(Mat4.translation(0, 1, 0));
        this.boat_rotation = Mat4.identity();
        this.view = "Boat"
        this.mapSize = 30;
        this.livesLeft = 3;
        this.played = false;
        this.show_radius = true;
        this.gameState = false;
        this.score = 0;

        // Generating Obstacle Positions
        this.numIslands = 8;
        this.numShipwrecks = 8;
        this.numFish = 15;
        this.obstacleRad = 1;

        this.obstacleMat = [];
        let boundsMultiplier = .9;
        while (this.obstacleMat.length < this.numIslands + this.numShipwrecks) {
                let x = Math.floor(Math.random() * 2 * boundsMultiplier * this.mapSize) - boundsMultiplier * this.mapSize;
                let z = Math.floor(Math.random() * 2 * boundsMultiplier * this.mapSize) - boundsMultiplier * this.mapSize;
                let newPos = true;

                // Checking generated positions aren't at boat spawn
                if(Math.sqrt((this.initial_boat_transform[0][3] - x) ** 2 + (this.initial_boat_transform[2][3] - z) ** 2) <= 8)
                    newPos = false;
                else
                // Checking generated positions aren't too close to an existing obstacle
                for (let i = 0; i < this.obstacleMat.length; i++) {
                    if (Math.sqrt((this.obstacleMat[i][0][3] - x) ** 2 + (this.obstacleMat[i][2][3] - z) ** 2) <= 8) {
                        newPos = false;
                        break;
                    }
                }
                
                // Use position to build matrix transformation for obstacle, push to array
                if(newPos) {
                    this.obstacleMat.push(Mat4.translation(x, .8, z).times(Mat4.rotation(Math.random() * 6 * Math.PI, 0, 1, 0)).times(Mat4.identity()));
                }
        }

        this.fish = [];
        while (this.fish.length < this.numFish) {
            this.generateFishPosition(boundsMultiplier);
        }
    }
    
    make_control_panel()
    {
        this.key_triggered_button("Start", ["Enter"], () => {});
        this.key_triggered_button("Increase Speed", ["ArrowUp"], () => {});
        this.key_triggered_button("Decrease Speed", ["ArrowDown"], () => {});
        this.key_triggered_button("Rotate Left", ["ArrowLeft"], () => {});
        this.key_triggered_button("Rotate Right", ["ArrowRight"], () => {});
        this.key_triggered_button("Boat View", ["b"], () => this.view = "Boat");
        this.key_triggered_button("Top View", ["t"], () => this.view = "Top");
        this.key_triggered_button("Free View", ["g"], () => this.view = "Free");
        this.key_triggered_button("Toggle Fishing Radius", ["h"], () => this.show_radius = !this.show_radius);
    }

    generateFishPosition(boundsMultiplier) {
        let x = Math.floor(Math.random() * 2 * boundsMultiplier * this.mapSize) - boundsMultiplier * this.mapSize;
        let z = Math.floor(Math.random() * 2 * boundsMultiplier * this.mapSize) - boundsMultiplier * this.mapSize;
        let newPos = true;

        // Checking generated positions aren't at boat spawn
        if(Math.sqrt((this.initial_boat_transform[0][3] - x) ** 2 + (this.initial_boat_transform[2][3] - z) ** 2) <= 8)
            newPos = false;
        else
            // Checking generated positions aren't too close to an existing obstacle
            for (let i = 0; i < this.obstacleMat.length; i++) {
                if (Math.sqrt((this.obstacleMat[i][0][3] - x) ** 2 + (this.obstacleMat[i][2][3] - z) ** 2) <= 8) {
                    newPos = false;
                    break;
                }
            }

        // Use position to build matrix transformation for obstacle, push to array
        if (newPos) {
            let initial_rotation = Mat4.rotation(Math.random() * 2 * Math.PI / 2, 0, 0, 1)
            let size = Math.random() * .5 + .5
            if (size >= .95) size = 1.5
            let fish_scr = Mat4.identity().times(Mat4.scale(.5 * size, .5 * size, .5 * size)).times(Mat4.rotation(3 * Math.PI / 2, 1, 0, 0).times(Mat4.rotation(Math.PI / 2, 0, 0, 1)))
            this.fish.push({"position": Mat4.translation(x, 0, z).times(fish_scr.times(initial_rotation)), "rotation_matrix": initial_rotation, "remaining_travel_time": 0, "speed": Math.random() * 0.05, "size": size, "fish_time": 0});
        } else {
            this.generateFishPosition(boundsMultiplier);
        }
    }

    drawObstacles(context, program_state) {
        // Draw barrier
        this.shapes.Barrier.draw(context, program_state, Mat4.translation(0,4,0).times(Mat4.scale(this.mapSize+4, this.mapSize+4, this.mapSize+4)).times(Mat4.identity()), this.materials.barrier);

        // Iterate through obstacle array to draw
        for (let i = 0; i < this.numIslands + this.numShipwrecks; i++) {
            if (i < this.numIslands) { // first few stored obstacles are islands
                this.shapes.Island.draw(context, program_state, Mat4.translation(0, 0.5, 0).times(this.obstacleMat[i]), this.materials.island);
            } else if (i < this.numIslands + this.numShipwrecks && this.obstacleMat[i][1][3] > 0) {// rest are shipwrecks. check if shipwreck has been sunk
                this.shapes.Shipwreck.draw(context, program_state, this.obstacleMat[i], this.materials.shipwreck);
            }
        }
    }

    drawFish(context, program_state, curr_time) {
        for (let i = this.numFish - 1; i >= 0; i--) {
            let fish_transform = this.fish[i]["position"]
            let fish_position = [fish_transform[0][3], fish_transform[1][3], fish_transform[2][3]]
            let curr_rotation = this.fish[i]["rotation_matrix"]
            let fish_travel_time = this.fish[i]["remaining_travel_time"]
            let fish_speed = this.fish[i]["speed"]
            let size = this.fish[i]["size"]
            let fish_time = this.fish[i]["fish_time"]
            if (this.checkObstacleCollisions(fish_position, false) == 5) {
                // kill the fish :(
                this.fish.splice(i, 1);
                continue;
            } else if (fish_travel_time - curr_time < 0) {               
                let new_rotation = Mat4.rotation(Math.random() * Math.PI, 0, 0, 1)
                fish_transform = fish_transform.times(new_rotation)
                curr_rotation = curr_rotation.times(new_rotation)
                fish_speed = (Math.random() * 0.01 + 0.01) * size
                fish_travel_time = curr_time + (Math.random() * 5 + 1)
            }

            if (this.checkNearPlayer(fish_position)) {
                if (fish_time != 0 && fish_time < curr_time) {
                    this.fish.splice(i, 1);
                    this.score += size * 50
                    continue;
                } else if (curr_time >= fish_time) {
                    fish_time = curr_time + this.fish_time * size
                }
            } else {
                if (fish_time - curr_time < this.fish_time - 0.1) {
                    fish_time = 0
                }
            }
            
            let fish_angle = Math.acos(curr_rotation[0][0]);
            if (curr_rotation[1][0] < 0) fish_angle = -(fish_angle) + 2 * Math.PI;
            fish_transform = Mat4.translation(fish_speed * Math.round(Math.cos(fish_angle)), 0, -fish_speed * Math.round(Math.sin(fish_angle))).times(fish_transform)

            const colorArray = ["#ff0000", "#fc0300", "#fa0500", "#f70800", "#f50a00", "#f20d00", "#f00f00", "#ed1200", "#eb1400",
                    "#e81700", "#e51a00", "#e31c00", "#e01f00", "#de2100", "#db2400", "#d92600", "#d62900", "#d42b00",
                    "#d12e00", "#cf3000", "#cc3300", "#c93600", "#c73800", "#c43b00", "#c23d00", "#bf4000", "#bd4200",
                    "#ba4500", "#b84700", "#b54a00", "#b24d00", "#b04f00", "#ad5200", "#ab5400", "#a85700", "#a65900",
                    "#a35c00", "#a15e00", "#9e6100", "#9c6300", "#996600", "#966900", "#946b00", "#916e00", "#8f7000",
                    "#8c7300", "#8a7500", "#877800", "#857a00", "#827d00", "#7f8000", "#7d8200", "#7a8500", "#788700",
                    "#758a00", "#738c00", "#708f00", "#6e9100", "#6b9400", "#699600", "#669900", "#639c00", "#619e00",
                    "#5ea100", "#5ca300", "#59a600", "#57a800", "#54ab00", "#52ad00", "#4fb000", "#4cb300", "#4ab500",
                    "#47b800", "#45ba00", "#42bd00", "#40bf00", "#3dc200", "#3bc400", "#38c700", "#36c900", "#33cc00",
                    "#30cf00", "#2ed100", "#2bd400", "#29d600", "#26d900", "#24db00", "#21de00", "#1fe000", "#1ce300", 
                    "#19e600", "#17e800", "#14eb00", "#12ed00", "#0ff000", "#0df200", "#0af500", "#08f700", "#05fa00", "#03fc00"]
            let colorIndex = 0;
            if (fish_time > 0) {
                colorIndex = Math.round((this.fish_time - (fish_time - curr_time))*(colorArray.length/this.fish_time))
            }

            let fishColor = size == 1.5 && colorIndex < 25 ? hex_color("#ffffff") : hex_color(colorArray[colorIndex])
            this.shapes.Fish.draw(context, program_state, fish_transform, this.materials.fish.override(fishColor));
            this.fish[i] = {"position": fish_transform, "rotation_matrix": curr_rotation, "remaining_travel_time": fish_travel_time, "speed": fish_speed, "size": size, "fish_time": fish_time}
        }
        while (this.fish.length < this.numFish) {
            // replace dead/caught fish with new 
            this.generateFishPosition(.6);
        }
    }

    checkObstacleCollisions(objPos, affect) {
        if (Math.abs(objPos[0]) > this.mapSize - 2 || Math.abs(objPos[2]) > this.mapSize - 2) {
            return 5; // hit border
        }

        for(let i = 0; i < this.numIslands + this.numShipwrecks; i++) {
            if(this.twoDimensionalCollision(objPos, this.boatRad, [this.obstacleMat[i][0][3], 0, this.obstacleMat[i][2][3]], this.obstacleRad)) {
                if (i < this.numIslands)
                    return 3; // hitting islands will end game
                else if (this.obstacleMat[i][1][3] > 0) {
                    if (affect) {
                        this.obstacleMat[i][1][3] = 0; // do not draw shipwreck again, shipwrecks hit will 'sink'
                    }
                    return 1; // hitting ships only take 1 life
                }
            }
        }
        return 0;
    }

    checkNearPlayer(objPos) {
        if(this.twoDimensionalCollision(objPos, this.fishing_radius, [this.boat_transform[0][3], this.boat_transform[1][3], this.boat_transform[2][3]], this.boatRad)) {
            return true;
        }
        return false;
    }

    // Simple Bounding Sphere collision given object transforms and assigned radii
    twoDimensionalCollision(transform1, r1, transform2, r2) {
        return Math.sqrt((transform1[0] - transform2[0])**2 + (transform1[2] - transform2[2])**2) < r1 + r2;
    }

    display(context, program_state) {
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        if (t == 0) {
            this.boat_transform = this.initial_boat_transform;
        }

        if (this.livesLeft <= 0 || !this.gameState) {
            this.livesLeft = 0;
            this.gameState = false;
            this.speed = 0;
        }

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());

            // Dont scroll with keys
            window.addEventListener("keydown", function(e) {
                if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
                    e.preventDefault();
                }
            }, false);
            
            // Move Boat if key pressed
            document.onkeydown = (e) => {
                e = e || window.event;
                if (this.gameState) {
                    if (e.key === "ArrowUp") {
                        this.key = e.key;
                        // Move the boat forward
                        if (this.speed < this.max_speed) {
                            this.speed += 0.001;  // Increase speed gradually
                        }
                    }
                    if (e.key === "ArrowDown") {
                        this.key = e.key;
                        // Move the boat backward
                        if (this.speed > -this.max_speed) {
                            this.speed -= 0.001;  // Decrease speed gradually
                        }
                    }
                    if (e.key === "ArrowLeft") {
                        this.key = e.key;
                        let rotationSpeed = 0.025 * Math.pow(.6, Math.abs(this.speed / this.max_speed));
                        this.boat_transform = this.boat_transform.times(Mat4.rotation(rotationSpeed, 0, 1, 0));
                        this.boat_rotation = this.boat_rotation.times(Mat4.rotation(rotationSpeed, 0, 1, 0));
                    }
                    if (e.key === "ArrowRight") {
                        this.key = e.key;
                        let rotationSpeed = 0.025 * Math.pow(.6, Math.abs(this.speed / this.max_speed));
                        this.boat_transform = this.boat_transform.times(Mat4.rotation(-rotationSpeed, 0, 1, 0));
                        this.boat_rotation = this.boat_rotation.times(Mat4.rotation(-rotationSpeed, 0, 1, 0));
                    }
                } else {
                    if (e.key === "Enter") {
                        this.gameState = true;
                        this.livesLeft = 3;
                        this.boat_transform = this.initial_boat_transform;
                        this.boat_rotation = Mat4.identity();
                        this.view = "Boat"
                        this.score = 0;
                        this.played = true;
                    }  
                }
            };
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 500);

        const light_position = vec4(10, 10, 10, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        if (!this.gameState) {
            program_state.set_camera(Mat4.identity())
            let title_transform = Mat4.identity()
                                        .times(Mat4.translation(-12, -8, -30))
                                        .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))
                                        .times(Mat4.rotation(Math.PI, 0, 1, 0))
                                        .times(Mat4.rotation(Math.PI, 0, 0, 1))
                                    
            this.shapes.text.set_string(`Press Enter To`, context.context);
            this.shapes.text.draw(context, program_state, title_transform, this.materials.text_image);

            title_transform = title_transform.times(Mat4.translation(0, 0, -3))
            this.shapes.text.set_string(`Start New Game`, context.context);
            this.shapes.text.draw(context, program_state, title_transform, this.materials.text_image);

            if (this.played) {
                title_transform = title_transform.times(Mat4.translation(5, 0, 10))
                this.shapes.text.set_string(`Score: ${this.score.toFixed(0)}`, context.context);
                this.shapes.text.draw(context, program_state, title_transform, this.materials.text_image);
            }

        } else {
            this.boat_transform = this.boat_transform.times(Mat4.translation(this.speed, 0, 0));   
            let water_transform = Mat4.identity().times(Mat4.scale(this.mapSize,1,this.mapSize));

            this.shapes.plane.arrays.texture_coord.forEach(
                (v, i, l) => {
                    l[i] = vec(v[0] * this.mapSize / 2, v[1] * this.mapSize / 2);
                }
            );
    
            this.shapes.plane.draw(context, program_state, water_transform, this.materials.ocean);
            this.drawObstacles(context, program_state);
            this.shapes.raft.draw(context, program_state, this.boat_transform, this.materials.wood);

            let fishing_circle_transform = this.boat_transform.times(Mat4.translation(0, -0.4, 0)).times(Mat4.scale(this.fishing_radius * 2, .1, this.fishing_radius * 2))

            if (this.show_radius)
                this.shapes.FishingCircle.draw(context, program_state, fishing_circle_transform, this.materials.fishing_circle);

            this.drawFish(context, program_state, t);

            let angle = Math.acos(this.boat_rotation[0][0]);
            if (this.boat_rotation[0][2] < 0) angle = -(angle) + 2*Math.PI;
        
    
            let boat_position = [this.boat_transform[0][3], this.boat_transform[1][3], this.boat_transform[2][3]]
            try {
                if (this.view == "Boat")
                {
                    let camera_transform = [vec3(boat_position[0] + 15 * Math.sin(angle), boat_position[1] + 5, boat_position[2] + 15 * Math.cos(angle)), vec3(boat_position[0] + 3 * Math.sin(angle), boat_position[1] + 5, boat_position[2] + 3 * Math.cos(angle)), vec3(0, 1, 0)];
                    let desired = Mat4.look_at(camera_transform[0], camera_transform[1], camera_transform[2]);
                    desired = desired.map((x, i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.1));
                    program_state.set_camera(desired);
                }
                else if (this.view == "Top")
                {
                    let camera_position = vec3(boat_position[0], boat_position[1] + 20, boat_position[2] + 5);
                    let target_position = vec3(boat_position[0], boat_position[1], boat_position[2]);
                    let up_vector = vec3(0, 0, -1);
                  
                    let desired = Mat4.look_at(camera_position, target_position, up_vector);
                    desired = desired.map((x, i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.025));
                    program_state.set_camera(desired);
                }
            } catch (e) {
                console.log(e);
            }
    
            this.livesLeft -= this.checkObstacleCollisions(boat_position, true);
            this.livesLeft = Math.max(this.livesLeft, 0)
    
    
            // Game Text
            let speed_transform = Mat4.identity()
            let lives_transform = Mat4.identity()
            let scores_transform = Mat4.identity()
    
            if (this.view == "Boat")
            {
                let text_scale = .5
                speed_transform = this.boat_transform
                                    .times(Mat4.scale(text_scale, text_scale, text_scale))
                                    .times(Mat4.translation(0, 0, -20))
                                    .times(Mat4.rotation(3 * Math.PI / 2, 1, 0, 0))
                                    .times(Mat4.rotation(3 * Math.PI / 2, 0, 0, 1))
    
                lives_transform = this.boat_transform
                                    .times(Mat4.scale(text_scale, text_scale, text_scale))
                                    .times(Mat4.translation(0, 2, -20))
                                    .times(Mat4.rotation(3 * Math.PI / 2, 1, 0, 0))
                                    .times(Mat4.rotation(3 * Math.PI / 2, 0, 0, 1))

                scores_transform = this.boat_transform
                                    .times(Mat4.scale(text_scale, text_scale, text_scale))
                                    .times(Mat4.translation(0, 4, -20))
                                    .times(Mat4.rotation(3 * Math.PI / 2, 1, 0, 0))
                                    .times(Mat4.rotation(3 * Math.PI / 2, 0, 0, 1))
            }
            else if(this.view == "Top" || this.view == "Free")
            {   
                let text_scale = .35
                speed_transform = Mat4.identity()
                                    .times(Mat4.scale(text_scale, text_scale, text_scale))
                                    .times(Mat4.translation(boat_position[0] * (1/text_scale) - 20, 1, boat_position[2] * (1/text_scale) + 14))
                                    .times(Mat4.rotation(Math.PI, 0, 0, 1))
                                    .times(Mat4.rotation(Math.PI, 0, 1, 0))
                                    
                      
                lives_transform = Mat4.identity()
                                    .times(Mat4.scale(text_scale, text_scale, text_scale))
                                    .times(Mat4.translation(boat_position[0] * (1/text_scale) - 20, 1, boat_position[2] * (1/text_scale) + 16))
                                    .times(Mat4.rotation(Math.PI, 0, 0, 1))
                                    .times(Mat4.rotation(Math.PI, 0, 1, 0))
                                    
                scores_transform = Mat4.identity()
                                    .times(Mat4.scale(text_scale, text_scale, text_scale))
                                    .times(Mat4.translation(boat_position[0] * (1/text_scale) - 20, 1, boat_position[2] * (1/text_scale) + 18))
                                    .times(Mat4.rotation(Math.PI, 0, 0, 1))
                                    .times(Mat4.rotation(Math.PI, 0, 1, 0))
                              
            }
    
            this.shapes.text.set_string(`Score: ${this.score.toFixed(0)}`, context.context);
            this.shapes.text.draw(context, program_state, scores_transform, this.materials.text_image);

            this.shapes.text.set_string(`${(100 * this.speed / this.max_speed).toFixed(0)}% Speed`, context.context);
            this.shapes.text.draw(context, program_state, speed_transform, this.materials.text_image);
    
            this.shapes.text.set_string(`${this.livesLeft} Lives Left`, context.context);
            this.shapes.text.draw(context, program_state, lives_transform, this.materials.text_image);

        }


    }
}


class Texture_Scroll_X extends Textured_Phong {
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            
            void main(){
                // Sample texture image
                float speed = 1.0;
                float factor = speed*mod(animation_time, 1.0/speed);
                vec2 scaled_tex_coord = vec2(f_tex_coord.x, f_tex_coord.y - factor);
                vec4 tex_color = texture2D( texture, f_tex_coord); // change f_tex_coord to scaled_tex_coord for movement
                
                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}

export class Shape_From_File extends Shape {
    // **Shape_From_File** is a versatile standalone Shape that imports
    // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) {
        // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then((response) => {
                if (response.ok) return Promise.resolve(response.text());
                else return Promise.reject(response.status);
            })
            .then((obj_file_contents) => this.parse_into_mesh(obj_file_contents))
            .catch((error) => {
                this.copy_onto_graphics_card(this.gl);
            });
    }

    parse_into_mesh(data) {
        // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [],
            vertNormals = [],
            textures = [],
            unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split("\n");

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices) unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split("/");

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[(vertex[1] - 1 || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[(vertex[1] - 1 || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const { verts, norms, textures } = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) {
        // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready) super.draw(context, program_state, model_transform, material);
    }
}

export class Text_Line extends Shape {
    // **Text_Line** embeds text in the 3D world, using a crude texture
    // method.  This Shape is made of a horizontal arrangement of quads.
    // Each is textured over with images of ASCII characters, spelling
    // out a string.  Usage:  Instantiate the Shape with the desired
    // character line width.  Then assign it a single-line string by calling
    // set_string("your string") on it. Draw the shape on a material
    // with full ambient weight, and text.png assigned as its texture
    // file.  For multi-line strings, repeat this process and draw with
    // a different matrix.
    
    constructor(max_size) {
        super("position", "normal", "texture_coord");
        this.max_size = max_size;
        var object_transform = Mat4.identity();
        for (var i = 0; i < max_size; i++) {    // Each quad is a separate Square instance:
            defs.Square.insert_transformed_copy_into(this, [], object_transform);
            object_transform.post_multiply(Mat4.translation(1.5, 0, 0));
        }
    }

    set_string(line, context) {
        // set_string():  Call this to overwrite the texture coordinates buffer with new
        // values per quad, which enclose each of the string's characters.
        this.arrays.texture_coord = [];
        for (var i = 0; i < this.max_size; i++) {
            var row = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) / 16),
                col = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) % 16);

            var skip = 3, size = 32, sizefloor = size - skip;
            var dim = size * 16,
                left = (col * size + skip) / dim, top = (row * size + skip) / dim,
                right = (col * size + sizefloor) / dim, bottom = (row * size + sizefloor + 5) / dim;

            this.arrays.texture_coord.push(...Vector.cast([left, 1 - bottom], [right, 1 - bottom],
                [left, 1 - top], [right, 1 - top]));
        }
        if (!this.existing) {
            this.copy_onto_graphics_card(context);
            this.existing = true;
        } else
            this.copy_onto_graphics_card(context, ["texture_coord"], false);
    }
}

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `
        precision mediump float;
        varying vec4 point_position;
        varying vec4 center;
        `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return (
            this.shared_glsl_code() +
            `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main(){
          point_position = model_transform * vec4(position, 1);
          center = model_transform * vec4(0, 0, 0, 1);
          gl_Position = projection_camera_model_transform * vec4(position, 1);
        }`
        );
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return (
            this.shared_glsl_code() +
            `
        void main(){
          gl_FragColor = sin(distance(center, point_position) * 5.0) * vec4(.01, .99, .81, 1.0);
        }`
        );
    }
}