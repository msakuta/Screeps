var flagNames = ['dig', 'dig2', 'dig3', 'dig4', 'dig5', 'dig6']

// Might be better to do prototyping
function getEnergy(struct){
    return struct instanceof StructureLink ? struct.energy : struct.store.energy
}

function getCapacity(struct){
    return struct instanceof StructureLink ? struct.energyCapacity : struct.storeCapacity
}

function getSpace(struct){
    return struct instanceof StructureLink ? struct.energyCapacity - struct.energy : struct.storeCapacity - _.sum(struct.store)
}


var roleDigger = {

    diggerCount: function(){
        return _.filter(flagNames, f => f in Game.flags).length
    },

    /** @param {Creep} creep **/
    run: function(creep) {
        function totalEnergy(){
            var energy = 0, energyCapacity = 0
            energy += Game.spawns.Spawn1.energy
            energyCapacity += Game.spawns.Spawn1.energyCapacity
            var exts = creep.room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType === STRUCTURE_EXTENSION})
            for(var i = 0; i < exts.length; i++){
                energy += exts[i].energy;
                energyCapacity += exts[i].energyCapacity
            }
            return [energy, energyCapacity]
        }

        /// Returns number of energy resource this creep could harvest in the same
        /// duration of moving dist.
        function totalPotentialHarvests(creep, dist){
            var workParts = creep.getActiveBodyparts(WORK)
            var harvestsPerTick = workParts * 2
            // Debug log
            //console.log('workParts: ' + workParts + ', totalPotentialHarvests: ' + totalPotentialHarvests)
            return harvestsPerTick * dist
        }

        let adjacentObjs = creep.room.lookAtArea(Math.max(0, creep.pos.y - 1), Math.max(0, creep.pos.x - 1), Math.min(49, creep.pos.y + 1), Math.min(49, creep.pos.x + 1), true)
        let structs = _.filter(adjacentObjs,
            s => s.type === 'structure' && (
                s.structure.structureType === STRUCTURE_CONTAINER || s.structure.structureType === STRUCTURE_LINK && getSpace(s.structure)))
        // Prefer a link
        let stile = _.reduce(structs, (best, s) => s.structure.structureType === STRUCTURE_LINK ? s : best, null)

        // Find a structure
        let struct = !stile ? 0 < structs.length ? structs[0].structure : null : stile.structure

        // Find and drop energy into adjacent container or link
        if(0 < creep.carry.energy){
            if(struct){
                if(struct.hits < struct.hitsMax)
                    creep.repair(struct)
                else
                    creep.transfer(struct, RESOURCE_ENERGY)
            }
            else if(creep.getActiveBodyparts(WORK) * 5 <= creep.carry.energy || creep.carry.energy === creep.carryCapacity){
                let cons = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES,
                    {filter: s => s.my && s.structureType === STRUCTURE_CONTAINER})
                if(cons)
                    creep.build(cons)
                else
                    creep.pos.createConstructionSite(STRUCTURE_CONTAINER)
            }
        }
        else if(struct && 0 < getSpace(struct)){
            // If there's an adjacent link to the creep and a dropped energy,
            // pick it up
            let dropResources = creep.pos.findInRange(FIND_DROPPED_ENERGY, 2)
            if(0 < dropResources.length){
                creep.pickup(dropResources[0])
            }
        }

        if(creep.memory.task === 'harvest' || true){
            if(!creep.memory.flag){
                for(let i = 0; i < flagNames.length; i++){
                    let flag = Game.flags[flagNames[i]]

                    if(!flag)
                        continue

                    if((function(){
                        for(let name in Game.creeps){
                            let creep2 = Game.creeps[name]
                            if(creep2 !== creep && creep2.memory.role === 'digger' && creep2.memory.flag === flag.name)
                                return true
                        }
                        return false
                    })())
                        continue

                    if(creep.memory.task !== 'harvest'){
                        creep.memory.task = 'harvest'
                    }

                    creep.memory.flag = flag.name
                }
            }

            if(creep.memory.flag){
                let flag = Game.flags[creep.memory.flag]
                // Find the closest source in this room.
                function findAndHarvest(){
                    var source = creep.pos.findClosestByRange(FIND_SOURCES,
                        s => 0 < s.energy && s.pos.getRangeTo(creep.pos) <= 2)
                    if(source){
                        if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(source);
                            creep.memory.target = source.id
                            return true
                        }
                        return true
                    }
                    return false
                }

                if(creep.room !== flag.room || 1 < creep.pos.getRangeTo(flag))
                    creep.moveTo(flag)
                else
                    findAndHarvest();
            }
            else{
                var target = Game.getObjectById(creep.memory.target)
                if(target instanceof Source && 0 < target.energy){
                    if(creep.harvest(target) === ERR_NOT_IN_RANGE)
                        creep.moveTo(target);
                }
                else{
                    console.log('digger: NO source target! ' + target)
                    creep.memory.target = undefined
                }
            }
            creep.memory.resting = undefined
        }
    }
};

module.exports = roleDigger;
