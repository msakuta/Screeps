
var spawnCreeps = {}

var roleHarvester = {

    sortDistance: function(){
        for(let k in Game.spawns){
            let spawn = Game.spawns[k]
            spawnCreeps[k] = _.filter(Game.creeps, (creep) => (creep.memory.role === 'harvester' || creep.memory.role === 'builder') && creep.room === spawn.room)
            for(var i = 0; i < spawnCreeps[k].length; i++)
                spawnCreeps[k][i].spawnDist = spawnCreeps[k][i].pos.getRangeTo(spawn)
            spawnCreeps[k].sort((a,b) => a.spawnDist - b.spawnDist)
            distArray = [];
            for(let i = 0; i < spawnCreeps[k].length; i++)
                distArray[i] = spawnCreeps[k][i].spawnDist
            // Debug log
            //console.log(distArray)
        }
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

        if(creep.carry.energy === creep.carryCapacity)
            creep.memory.harvesting = undefined

        if(creep.memory.harvesting || creep.carry.energy === 0) {
            if(!creep.memory.harvesting){
                creep.memory.harvesting = true
                creep.say('harvester')
            }
            let hostile = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => !(s instanceof StructureController) && s.pos.getRangeTo(creep.pos) < 25})
            if(hostile){
                if(creep.dismantle(hostile) === ERR_NOT_IN_RANGE)
                    creep.moveTo(hostile)
                return
            }
            var energies = totalEnergy()
            var thirsty = true
            var spawn
            for(let k in Game.spawns)
                if(Game.spawns[k].room === creep.room)
                    spawn = Game.spawns[k]
            if(energies[0] < energies[1] && spawn && spawnCreeps[spawn.name].indexOf(creep) < 3){
                var source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && 0 < s.store.energy
                });
                if(source){
                    if(creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    }
                    thirsty = false
                }
	        }
            if(thirsty){
                var target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                var path = target ? creep.pos.findPathTo(target) : null
                // Go to dropped resource if a valid path is found to it and worth it
                if(target && path && totalPotentialHarvests(creep, path.length) < target.amount){
                    creep.move(path[0].direction)
                    creep.pickup(target);
                }
                else if(!creep.room.controller || creep.room.controller.my){
                    var sources = []
                    // We can't find the closest source among multiple rooms.
/*                    for(let k in Game.spawns){
                        let spawn = Game.spawns[k]
                        if(spawn.my)
                            sources = sources.concat(spawn.room.find(FIND_SOURCES))
                    }*/
                    //console.log(creep.name + ': ' + sources.length)

                    // Find the closest source in this room.
                    var source = creep.pos.findClosestByRange(FIND_SOURCES, {
                        // Skip empty sources, but if it's nearing to regenration, it's worth approaching.
                        // This way, creeps won't waste time by wandering about while waiting regeneration.
                        // The rationale behind this number is that you can reach the other side of a room
                        // approximately within 50 ticks, provided that roads are properly layed out.
                        filter: s => 0 < s.energy || s.ticksToRegeneration < 50
                    });
                    if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    }
                }
            }
            creep.memory.resting = undefined
        }
        else {
            function tryFindTarget(types, isFilled){
                var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => {
                        for(var i = 0; i < types.length; i++){
                            if(types[i] === s.structureType && isFilled(s))
                                return true
                        }
                        return false
                    }
                })
                if(target){
                    if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target);
                    }
                    creep.memory.resting = undefined
                    //creep.say('fill ' + target.structureType)
                    return true
                }
                return false
            }

            // Precede filling tower, then extension and spawn, lastly container and storage.
            if(!tryFindTarget([STRUCTURE_TOWER], s => {
                    // Tower tend to spend tiny amount of energy from time to time for repairing
                    // roads and containers, so don't spend time for filling tiny amount of energy.
                    // Specifically, if this creep can harvest more than the energy amount it could
                    // transfer to the tower in the same duration of moving to the tower, it's not
                    // worth transferring (spending time for harvesting is more beneficial).
                    // That said, if the tower is getting short in energy, we can't help but restoring it.
                    if(s.energy < s.energyCapacity * 0.7)
                        return true
                    var fillableEnergy = Math.min(creep.carry.energy, s.energyCapacity - s.energy)
                    return totalPotentialHarvests(creep, creep.pos.getRangeTo(s)) < fillableEnergy}) &&
                !tryFindTarget([STRUCTURE_EXTENSION, STRUCTURE_SPAWN], s => s.energy < s.energyCapacity) &&
                !tryFindTarget([STRUCTURE_CONTAINER, STRUCTURE_STORAGE], s => s.store.energy < s.storeCapacity))
            {
                // If there's nothing to do, find a room with least working force
                // and visit it as a helping hand.
                // Technically, the least working force does not necessarily meaning
                // the highest demand, but it's simple and effective approximation.
                var leastSpawn = null
                var leastHarvesterCount = 10
                for(let k in Game.spawns){
                    let spawn = Game.spawns[k]
                    if(spawn.my){
                        let harvesterCount = _.filter(Game.creeps, c => c.room === spawn.room && c.memory.role === 'harvester').length
                        if(harvesterCount < leastHarvesterCount){
                            leastHarvesterCount = harvesterCount
                            leastSpawn = spawn
                        }
                    }
                }
                //console.log(leastSpawn + ' ' + leastHarvesterCount)
                if(leastSpawn)
                    creep.moveTo(leastSpawn)
                creep.memory.harvesting = true

                // Temporarily disable the code to go to resting place since
                // creeps in the other rooms than the location of rest flag
                // rush to the flag.
/*                var flag = Game.flags['rest']
                if(flag && !flag.pos.isNearTo(creep.pos))
                    creep.moveTo(flag)
                else if(!creep.memory.resting){
                    creep.say('at flag')
                    creep.memory.resting = true
                }*/
            }
        }
    }
};

module.exports = roleHarvester;
