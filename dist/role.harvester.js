var stats = require('stats')

var spawnCreeps = {}

function countTargetingCreeps(target, ignore){
    var ret = 0
    for(var name in Game.creeps){
        if(Game.creeps[name] !== ignore && Game.creeps[name].memory.target === target.id)
            ret++
    }
    return ret
}

function sourcePredicate(s, creep){
    // Skip empty sources, but if it's nearing to regenration, it's worth approaching.
    // This way, creeps won't waste time by wandering about while waiting regeneration.
    // The rationale behind this number is that you can reach the other side of a room
    // approximately within 50 ticks, provided that roads are properly layed out.
    return  (0 < s.energy || s.ticksToRegeneration < 50) &&
        // If there are enough harvesters gathering around this source, skip it.
        //(!Memory.sources[s.id] || Memory.sources[s.id].length < 2)
        countTargetingCreeps(s, creep) < countAdjacentSquares(s.pos,
            s2 => s2.type === LOOK_TERRAIN && s2[LOOK_TERRAIN] !== 'wall')+1
}

function countAdjacentSquares(pos, filter){
    var squares = 0
    var room = Game.rooms[pos.roomName]
    if(room)
        room.lookAtArea(Math.max(0, pos.y-1), Math.max(0, pos.x-1),
            Math.min(49, pos.y+1), Math.min(49, pos.x+1), true).forEach(s => {
                if(filter(s))
                    squares++
            })
    return squares
}

var roleHarvester = {

    sortDistance: function(){
        for(let k in Game.spawns){
            let spawn = Game.spawns[k]
            spawnCreeps[k] = _.filter(Game.creeps, (creep) => creep.room === spawn.room &&
                (creep.memory.role === 'harvester' || creep.memory.role === 'builder' && creep.memory.task !== 'build'))
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

    countTargetingCreeps: countTargetingCreeps,

    sourcePredicate: sourcePredicate,

    countAdjacentSquares: countAdjacentSquares,

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

        if(_.sum(creep.carry) === creep.carryCapacity){
            creep.memory.task = undefined
            creep.memory.target = undefined
        }

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
        else{
            var freeCapacity = creep.carryCapacity - _.sum(creep.carry)
            var energies = stats.totalEnergy(creep.room)

            var tasks = []

            function harvest(source){
                if(!source)
                    return false
                if(source instanceof Source){
                    if(source.energy === 0){
                        creep.memory.target = undefined
                        return false
                    }
                }
                else if(source instanceof Mineral){
                    if(source.mineralAmount === 0){
                        creep.memory.target = undefined
                        return false
                    }
                }
                if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source);
                    creep.memory.target = source.id
                    creep.memory.task = 'harvest'
                    //console.log(source.id + ' Adj: ' + countAdjacentSquares(source.pos,
                    //    s2 => s2.type === LOOK_TERRAIN && s2[LOOK_TERRAIN] !== 'wall'))
/*                                        if(!Memory.sources)
                        Memory.sources = {source.id: [creep.name]}
                    let sourceMem = Memory.sources[source.id]
                    if(sourceMem.indexOf(creep.name) < 0)
                        sourceMem.push(creep.name)*/
                }
                return true
            }

            function findTarget(types, isFilled){
                var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => {
                        for(var i = 0; i < types.length; i++){
                            if(types[i] === s.structureType && isFilled(s))
                                return true
                        }
                        return false
                    }
                })
                return target
            }

            var spawn
            for(let k in Game.spawns)
                if(Game.spawns[k].room === creep.room)
                    spawn = Game.spawns[k]
            // Try to assign 'fill' task only if there is a container or storage
            // with excess energy.
            let creepIndex = spawn ? spawnCreeps[spawn.name].indexOf(creep) : -1
            if(creep.room.energyAvailable < creep.room.energyCapacityAvailable && energies[2] && 0 <= creepIndex && creepIndex < 2)
                creep.memory.task = 'fill'

            // Bother withdrawing from a container, a storage or a link if there
            // is at least 50 empty space in the carry.
            if(50 <= freeCapacity && (creep.memory.task === 'harvest' || creep.memory.task === 'fill') || _.sum(creep.carry) === 0){
                let containerWithdraw = !spawn || creep.memory.task === 'fill' || creep.room.energyAvailable < creep.room.energyCapacityAvailable && spawnCreeps[spawn.name].indexOf(creep) < 2
                // Withdraw from container or storage only if there is a vacant
                // extension, but always try to withdraw from sink link.
                let source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => containerWithdraw && (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && 0 < s.store.energy ||
                        s.structureType === STRUCTURE_LINK && s.sink && 0 < s.energy && creep.pos.getRangeTo(s) < 10
                });
                if(source){
                    let amount = source instanceof StructureLink ? source.energy : source.store.energy
                    let costFactor = source instanceof StructureLink ? 0.5 : 1 // Prefer withdrawing from links
                    tasks.push({
                        name: 'Container',
                        cost: costFactor * source.pos.getRangeTo(creep) / Math.min(freeCapacity, amount),
                        target: source,
                        run: (target) => {
                            if(creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                                creep.moveTo(target);
                            }
                            thirsty = false
                        }
                    })
                }

                // If this creep carries minerals (resources other than energy),
                // store them into a strage, but not into a container.
                source = creep.pos.findClosestByRange(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER && 1 < _.size(s.store)})
                if(source){
                    tasks.push({
                        name: 'ContainerMineral',
                        cost: 0.5 * source.pos.getRangeTo(creep) / Math.min(freeCapacity, _.sum(source.store) - source.store.energy),
                        target: source,
                        run: target => {
                            var mineralType = (() => {for(var i in target.store) if(i !== RESOURCE_ENERGY) return i})()
                            if(!mineralType)
                                return
                            if(creep.withdraw(target, mineralType))
                                creep.moveTo(target);
                        }
                    })
                }

                if(creep.memory.task === 'fill' && creep.room.energyAvailable === creep.room.energyCapacityAvailable)
                    creep.memory.task = 'harvest'
            }

            if(0 < freeCapacity){
                // Always try to find and collect dropped resources
                var target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                var path = target ? creep.pos.findPathTo(target) : null
                // Go to dropped resource if a valid path is found to it and worth it
                if(target && path && path.length && totalPotentialHarvests(creep, path.length) < target.amount){
                    tasks.push({
                        name: 'DropResource',
                        // Prefer dropped resources because they degrade
                        cost: .5 * creep.pos.getRangeTo(target) / Math.min(freeCapacity, target.amount),
                        target: target,
                        run: (target) => {
                            if(ERR_NOT_IN_RANGE === creep.pickup(target))
                                creep.move(path[0].direction)
                        }
                    })
                }

                // The cost of harvesting source is not straightforward, but
                // we can calculate it by the reward of first tick, i.e.
                // harvestable energy per tick
                let workParts = creep.getActiveBodyparts(WORK)
                if(0 < workParts){
                    let target = creep.pos.findClosestByRange(FIND_SOURCES, {filter: s => sourcePredicate(s, creep)})
                    if(target && 0 < target.energy){
                        tasks.push({
                            name: 'Source',
                            cost: creep.pos.getRangeTo(target) / Math.min(target.energy, workParts * 2) * 10,
                            target: target,
                            run: (target) => harvest(target)
                        })
                    }

                    function mineralFilter(s){
                        if(s.mineralAmount === 0)
                            return false
                        var extractor = _.filter(s.room.lookAt(s), s => s.type === 'structure' && s.structure.structureType === STRUCTURE_EXTRACTOR)
                        //if(extractor.length === 1)
                        //    console.log('extractor on mineral ' + s + ': ' + extractor.length)
                        return extractor.length === 1
                    }

                    target = creep.pos.findClosestByRange(FIND_MINERALS, {filter: mineralFilter})
                    if(target){
                        tasks.push({
                            name: 'Mineral',
                            cost: creep.pos.getRangeTo(target) / Math.min(target.mineralAmount, workParts * 2) * 10,
                            target: target,
                            run: harvest
                        })
                    }
                }
            }

            if(creep.memory.task !== 'harvest' && 50 <= creep.carry.energy){
                var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) && s.energy < s.energyCapacity
                })
                if(target){
                    tasks.push({
                        name: 'DumpExtension',
                        // Filling extensions has slightly less cost, meaning high priority, than storages.
                        cost: (creep.pos.getRangeTo(target) - .5) / Math.min(creep.carry.energy, target.energyCapacity - target.energy),
                        target: target,
                        run: (target) => {
                            // Dump all types of resources
                            for(let res in creep.carry){
                                if(creep.transfer(target, res) == ERR_NOT_IN_RANGE) {
                                    creep.moveTo(target);
                                }
                            }
                            creep.memory.resting = undefined
                        }
                    })
                }
            }

            // Dump to containers only if the room is controlled by me.
            if(creep.memory.task !== 'harvest' && 0 < _.sum(creep.carry)){

                if(creep.room.controller && creep.room.controller.my &&
                    (0 < _.sum(creep.carry) - creep.carry.energy || creep.room.energyAvailable === creep.room.energyCapacityAvailable)){
                    // If this creep has something other than energy, always dump it
                    // into the storage, not the containers.
                    let target = findTarget(0 < _.size(creep.carry) - creep.carry.energy ?
                        [STRUCTURE_STORAGE, STRUCTURE_TERMINAL] :
                        [STRUCTURE_CONTAINER, STRUCTURE_STORAGE], s => _.sum(s.store) < s.storeCapacity)
                    if(target){
                        tasks.push({
                            name: 'DumpContainer',
                            cost: 2 * creep.pos.getRangeTo(target) / Math.min(_.size(creep.carry), target.storeCapacity - _.sum(target.store)),
                            target: target,
                            run: (target) => {
                                // Dump all types of resources
                                for(let res in creep.carry){
                                    if(creep.transfer(target, res) == ERR_NOT_IN_RANGE) {
                                        creep.moveTo(target);
                                    }
                                }
                                creep.memory.resting = undefined
                            }
                        })
                    }
                }

                // Very low priority action to move resources to a spawn, if this creep has some.
                // This is necessary to prevent creeps from standing still with resources held
                // in a remote room.
                // I'd like to find or measure distance to the closest room with my spawn, but
                // there's no straightforward way to do that.
                if(!creep.room.controller || !creep.room.controller.my){
                    for(let name in Game.spawns){
                        tasks.push({
                            name: 'MoveToSpawn',
                            cost: 2 * 50 / _.size(creep.carry), // Assume the room is as distant as 50 squares.
                            target: Game.spawns[name],
                            run: target => creep.moveTo(target)
                        })
                        break
                    }
                }
            }

            //if(!tasks.length)
            //    console.log(creep.name + ': tasks: ' + tasks.length)
            if(tasks.length){
                let bestTask = _.reduce(tasks, (best, task) => {
                    if(task.cost < best.cost)
                        return task
                    return best
                })
                if(!isFinite(bestTask.cost))
                    console.log("WARNING: infinite cost detected! [" + bestTask.name + "]")
                //let costs = _.reduce(tasks, (str, task) => str += '[' + task.name +': ' + task.cost + '],', '')
                //console.log(creep.name + ': tasks: ' + tasks.length + ': bestTask: ' + bestTask.name + ', ' + bestTask.cost + ', ' + costs + ', ' + bestTask.target)
                bestTask.run(bestTask.target)
            }
            else if(creep.memory.task === 'harvest' || _.sum(creep.carry) === 0) {
                if(!creep.memory.target){
                    // If this creep has resources other than energy, store it to a
                    // storage before continuing because its capacity will be mixed.
                    for(let res in creep.carry){
                        if(res !== RESOURCE_ENERGY){
                            creep.memory.task = 'store'
                            return
                        }
                    }
                    if(creep.memory.task !== 'harvest' && creep.memory.task !== 'fill'){
                        creep.memory.task = 'harvest'
                        creep.say('harvester')
                    }
                    let hostile = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                        filter: s => !(s instanceof StructureController) && s.hits < 1e5 && s.pos.getRangeTo(creep.pos) < 25
                    })
                    if(hostile){
                        if(creep.dismantle(hostile) === ERR_NOT_IN_RANGE)
                            creep.moveTo(hostile)
                        return
                    }
                    var thirsty = true

                    if(!creep.room.controller || creep.room.controller.my || !creep.room.controller.owner){
                        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: s => s.structureType === STRUCTURE_LINK && s.sink && 0 < s.energy &&
                                creep.pos.getRangeTo(s) <= 5
                        })
                        if(target){
                            if(creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
                                creep.moveTo(target);
                        }
                        else if(!creep.memory.target || !harvest(Game.getObjectById(creep.memory.target))){
                            var sources = []
                            // We can't find the closest source among multiple rooms.
        /*                    for(let k in Game.spawns){
                                let spawn = Game.spawns[k]
                                if(spawn.my)
                                    sources = sources.concat(spawn.room.find(FIND_SOURCES))
                            }*/
                            //console.log(creep.name + ': ' + sources.length)

                            // Find the closest source in this room.
                            function findAndHarvest(){
                                return harvest(creep.pos.findClosestByRange(FIND_SOURCES, {filter: sourcePredicate}))
                            }

                            if(findAndHarvest());
                            else{
                                if(Game.flags.extra !== undefined){
                                    creep.moveTo(Game.flags.extra)
    /*                                    let flagroom = Game.flags.extra.room
                                    if(flagroom === creep.room){
                                        findAndHarvest()
                                    }
                                    else{
                                        let exit = creep.room.findExitTo(flagroom)
                                        //console.log(creep.name + ': harvester flagroom: ' + flagroom + 'idle: ' + exit)
                                        creep.moveTo(flagroom)*/
        /*                                if(0 <= exit){
                                            let expos = creep.pos.findClosestByRange(exit)
                                            creep.moveTo()
                                        }*/
                                    //}
                                }
                                else{

                                    // If this creep cannot allot the right to harvest a source, get out of the way
                                    // for other creeps.
                                    var source = creep.pos.findClosestByRange(FIND_SOURCES)
                                    var sourceRange = creep.pos.getRangeTo(source)
                                    if(sourceRange <= 2){
                                        let awayPath = PathFinder.search(creep.pos, {pos: source.pos, range: 3}, {flee: true}).path
                                        //console.log(awayPath)
                                        if(awayPath.length)
                                            creep.moveTo(awayPath[awayPath.length-1])
                                    }
                                    else if(4 < sourceRange){
                                        creep.moveTo(source)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            else if(creep.memory.target){
                // If this creep finds dropped resources next to it, pick it up
                // even if a target is acquired, because it won't cost a tick.
                var target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, s => creep.pos.getRangeTo(s) <= 2);
                if(target)
                    creep.pickup(target)

                var target = Game.getObjectById(creep.memory.target)
                if(target instanceof Source && 0 < target.energy){
                    if(creep.harvest(target) === ERR_NOT_IN_RANGE)
                        creep.moveTo(target);
                }
                else if(target instanceof Mineral && 0 < target.mineralAmount){
                    if(creep.harvest(target) === ERR_NOT_IN_RANGE)
                        creep.moveTo(target);
                }
                else{
                    console.log('NO source target! ' + target)
                    creep.memory.target = undefined
                }
            }
            creep.memory.resting = undefined
        }
        if(creep.carry.energy === creep.carryCapacity){
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
                    // Dump all types of resources
                    for(let res in creep.carry){
                        if(creep.transfer(target, res) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(target);
                        }
                    }
                    creep.memory.resting = undefined
                    //creep.say('fill ' + target.structureType)
                    return true
                }
                return false
            }

            //console.log('creep ' + creep.name + ' storing: ' + creep.memory.task)

            let nonEnergy = false
            for(let name in creep.carry){
                if(name !== RESOURCE_ENERGY){
                    nonEnergy = true
                    break
                }
            }

            if(nonEnergy){
                // Always store minerals into a storage
                tryFindTarget([STRUCTURE_STORAGE], s => _.sum(s.store) < s.storeCapacity)
            }
            else if(0 < creep.carry.energy){

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
                    (creep.room.energyAvailable < creep.room.energyCapacityAvailable || !tryFindTarget([STRUCTURE_LINK], s => {
                        if(!s.source || !(s.energy < s.energyCapacity) || 3 < creep.pos.getRangeTo(s))
                            return false
                        var fillableEnergy = Math.min(creep.carry.energy, s.energyCapacity - s.energy)
                        return totalPotentialHarvests(creep, creep.pos.getRangeTo(s)) < fillableEnergy})) &&
                    !tryFindTarget([STRUCTURE_EXTENSION, STRUCTURE_SPAWN], s => s.energy < s.energyCapacity) &&
                    (!creep.room.controller || !creep.room.controller.my ||
                        !tryFindTarget([STRUCTURE_CONTAINER, STRUCTURE_STORAGE], s => _.sum(s.store) < s.storeCapacity)))
                {
                    // If there is a room with a Spawn but few upgraders, change the role to upgrader to support the room's control.
                    let noupgraderRooms = _.filter(Game.rooms, r => r.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_SPAWN}}).length &&
                        r.find(FIND_MY_CREEPS, {filter: c => c.memory.role === 'upgrader'}).length < 3)
                    if(noupgraderRooms.length){
                        let noupgraderRoom = noupgraderRooms[0]
                        if(noupgraderRoom === creep.room)
                            creep.memory.role = 'upgrader'
                        else
                            creep.moveTo(noupgraderRoom)
                    }
                    else{
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
                    if(leastSpawn){
                        creep.moveTo(leastSpawn)
                    }
                    creep.memory.task = 'harvest'
                    }

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
            else{
                creep.memory.task = undefined
            }
        }
    }
};

module.exports = roleHarvester;
