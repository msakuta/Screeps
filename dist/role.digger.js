
var roleDigger = {

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

        // Find and drop energy into adjacent container
        if(0 < creep.carry.energy){
            let struct
            let structs = _.filter(creep.room.lookAt(creep.pos), s => s.type === 'structure' && s.structure.structureType === STRUCTURE_CONTAINER)
            for(let i = 0; i < structs.length; i++)
                struct = structs[i]
            console.log('digger: ' + struct)
            if(struct){
                creep.transfer(struct, RESOURCE_ENERGY)
                creep.memory.task = undefined
                creep.memory.target = undefined
            }
            else{
                let cons = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES,
                    {filter: s => s.my && s.structureType === STRUCTURE_CONTAINER})
                if(cons)
                    creep.build(cons)
                else
                    creep.pos.createConstructionSite(STRUCTURE_CONTAINER)
            }
        }

        if(creep.memory.task === 'harvest' || true){
            let flagNames = ['dig', 'dig2']
            if(!creep.memory.flag){
                for(let i = 0; i < flagNames.length; i++){
                    let flag = Game.flags[flagNames[i]]

                    console.log('digger: flag[' + flagNames[i] + ']' + flag)
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
