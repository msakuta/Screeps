
module.exports = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.memory.task === 'gather'){
            if(creep.carry.energy === creep.carryCapacity){
                creep.memory.task = 'transport'
                return
            }
            var fromSpawn = Game.spawns.Spawn2
            if(fromSpawn){
                if(creep.room === fromSpawn.room){
                    let container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: s => (s.structureType === STRUCTURE_CONTAINER ||
                            s.structureType === STRUCTURE_STORAGE) &&
                            0 < s.store.energy && s.room === creep.room
                    })
                    if(container){
                        if(creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
                            creep.moveTo(container)
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
                else{
                    creep.moveTo(fromSpawn)
                }
            }
        }
        else if(creep.memory.task === 'transport'){
            if(creep.carry.energy === 0){
                creep.memory.task = 'gather'
            }
            var toSpawn = Game.spawns.Spawn1
            if(toSpawn){
                if(creep.room === toSpawn.room){
                    let container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: s => (s.structureType === STRUCTURE_CONTAINER ||
                            s.structureType === STRUCTURE_STORAGE) &&
                            s.store.energy < s.storeCapacity
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
