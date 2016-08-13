
/// We don't want to waste time for picking up tiny amount of energy by diverting from
/// the main course, but if it's very close to the creep, it's worth bothering.
/// This function is a measure of how distance is worth, in energy units.
/// Unlike harvesters, transporter's time value is dependent on total travel
/// distance (you won't mind 100 feet of excess walking if your journey is a
/// mile long, but if you're walking to next building 200 feet away, it counts).
/// Nevertheless, we assume one step is worth 1/10 of total carrying capacity,
/// in order to avoid complications.
function walkCost(creep, dist){
    var carryParts = creep.getActiveBodyparts(CARRY)
    // Debug log
    //console.log('workParts: ' + workParts + ', totalPotentialHarvests: ' + totalPotentialHarvests)
    return carryParts * dist / 10
}


module.exports = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // Recycle damaged creeps
        if(creep.hits < creep.hitsMax){
            let target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_SPAWN}})
            if(target){
                if(ERR_NOT_IN_RANGE === target.recycleCreep(creep))
                    creep.moveTo(target)
            }
            else if(Game.spawns.Spawn2)
                creep.moveTo(Game.spawns.Spawn2)
            else
                creep.moveTo(Game.spawns.Spawn1)
        }
        else if(creep.memory.task === 'gather'){
            if(creep.carry.energy === creep.carryCapacity){
                creep.memory.task = 'store'
                return
            }
            var fromSpawn = Game.spawns.Spawn2
            if(fromSpawn){
                let roomGathering = false
                if(creep.room === fromSpawn.room || !creep.room.controller || !creep.room.controller.my){
                    let resource = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES)
                    let path = resource ? creep.pos.findPathTo(resource) : null
                    // Go to dropped resource if a valid path is found to it and worth it
                    if(resource && path && path.length && walkCost(creep, path.length) < resource.amount){
                        if(creep.pickup(resource) === ERR_NOT_IN_RANGE)
                            creep.move(path[0].direction)
                        roomGathering = true
                    }
                    else{
                        let container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: s => (s.structureType === STRUCTURE_CONTAINER ||
                                s.structureType === STRUCTURE_STORAGE) &&
                                0 < s.store.energy && s.room === creep.room
                        })
                        if(container){
                            if(creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
                                creep.moveTo(container)
                            roomGathering = true
                        }
                        else{
                            let source = creep.pos.findClosestByRange(FIND_SOURCES, {filter: s => s.room === creep.room})
                            if(source){
                                if(creep.pos.getRangeTo(source) <= 2){
                                    let awayPath = PathFinder.search(creep.pos, {pos: source.pos, range: 3}, {flee: true}).path
                                    //console.log(awayPath)
                                    if(awayPath.length)
                                        creep.moveTo(awayPath[awayPath.length-1])
                                }
    //                            if(creep.harvest(source) === ERR_NOT_IN_RANGE){
    //                                creep.moveTo(source)
    //                            }
                            }
                        }
                    }
                }
                if(!roomGathering){
                    creep.moveTo(fromSpawn)
                }
            }
        }
        else if(creep.memory.task === 'store'){
            if(creep.carry.energy === 0){
                creep.memory.task = 'gather'
            }
            var toSpawn = Game.spawns.Spawn1
            if(toSpawn){
                if(creep.room === toSpawn.room){
                    let container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: s => (s.structureType === STRUCTURE_CONTAINER ||
                            s.structureType === STRUCTURE_STORAGE) &&
                            s.store.energy < s.storeCapacity ||
                            (s.structureType === STRUCTURE_LINK && s.source &&
                            s.energy < s.energyCapacity)
                    })
                    if(creep.transfer(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE){
                        creep.moveTo(container)
                    }
                }
                else{
                    creep.moveTo(toSpawn)
                }
            }
        }
        else
            creep.memory.task = 'gather'
    }
};
